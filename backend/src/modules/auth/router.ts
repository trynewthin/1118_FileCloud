import express from "express";
import { db } from "../../core/db/index.ts";
import { hashSecret } from "../../core/security/hash.ts";
import { signUserToken } from "../../core/auth/jwt.ts";
import type { UserRole } from "../../core/auth/roles.ts";
import { PermissionLevel } from "../../core/auth/roles.ts";
import { authenticate, requirePermission } from "../../core/auth/permission.ts";
import { isRegisterAllowed } from "../../core/config/paths.ts";

const router = express.Router();

// 用户数据行类型
interface UserRow {
  id: number;
  username: string;
  password_hash: string | null;
  secret_hash: string | null;
  role: UserRole;
}

// 查询注册是否开放
router.get("/register-status", (_req, res) => {
  return res.json({ allowed: isRegisterAllowed() });
});

// 用户注册
router.post("/register", (req, res) => {
  // 检查注册开关
  if (!isRegisterAllowed()) {
    return res.status(403).json({ message: "当前不允许注册" });
  }

  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  // 验证用户名
  if (!username || typeof username !== "string" || username.trim().length < 2) {
    return res.status(400).json({ message: "用户名至少需要 2 个字符" });
  }

  // 验证密码
  if (!password || typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ message: "密码至少需要 6 个字符" });
  }

  const trimmedUsername = username.trim();

  // 检查用户名是否已存在
  const existing = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get(trimmedUsername);
  if (existing) {
    return res.status(409).json({ message: "用户名已存在" });
  }

  // 创建用户（默认角色为 user）
  const role: UserRole = "user";
  const passwordHash = hashSecret(password);

  const insert = db.prepare(
    "INSERT INTO users(username, password_hash, role) VALUES(?, ?, ?)",
  );
  const result = insert.run(trimmedUsername, passwordHash, role);

  const user = {
    id: Number(result.lastInsertRowid),
    username: trimmedUsername,
    role,
  } as const;

  const token = signUserToken(user);

  return res.status(201).json({ user, token });
});

// 登录（支持用户名+密码 或 仅密钥）
router.post("/login", (req, res) => {
  const { username, password, secret } = req.body as {
    username?: string;
    password?: string;
    secret?: string;
  };

  let row: UserRow | undefined;

  // 方式一：密钥登录
  if (secret && typeof secret === "string") {
    const secretHash = hashSecret(secret);
    row = db
      .prepare(
        "SELECT id, username, password_hash, secret_hash, role FROM users WHERE secret_hash = ? LIMIT 1",
      )
      .get(secretHash) as UserRow | undefined;

    if (!row) {
      return res.status(401).json({ message: "密钥错误或用户不存在" });
    }
  }
  // 方式二：用户名 + 密码登录
  else if (username && password) {
    const trimmedUsername = username.trim();
    const passwordHash = hashSecret(password);

    row = db
      .prepare(
        "SELECT id, username, password_hash, secret_hash, role FROM users WHERE username = ? LIMIT 1",
      )
      .get(trimmedUsername) as UserRow | undefined;

    if (!row) {
      return res.status(401).json({ message: "用户名或密码错误" });
    }

    // 验证密码
    if (!row.password_hash || row.password_hash !== passwordHash) {
      return res.status(401).json({ message: "用户名或密码错误" });
    }
  } else {
    return res.status(400).json({ message: "请提供用户名和密码，或提供密钥" });
  }

  const user = {
    id: row.id,
    username: row.username,
    role: row.role,
  } as const;

  const token = signUserToken(user);

  return res.json({ user, token });
});

// 获取当前登录用户信息
router.get("/me", authenticate, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "未登录" });
  }

  return res.json({ user: req.user });
});

// 修改当前用户密码
router.put("/me/password", authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!req.user) {
    return res.status(401).json({ message: "未登录" });
  }

  // 验证新密码
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: "新密码至少需要 6 个字符" });
  }

  // 获取当前用户信息
  const row = db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(req.user.id) as { password_hash: string | null } | undefined;

  if (!row) {
    return res.status(404).json({ message: "用户不存在" });
  }

  // 如果已设置密码，需要验证当前密码
  if (row.password_hash) {
    if (!currentPassword) {
      return res.status(400).json({ message: "请输入当前密码" });
    }
    const currentHash = hashSecret(currentPassword);
    if (currentHash !== row.password_hash) {
      return res.status(401).json({ message: "当前密码错误" });
    }
  }

  // 更新密码
  const newHash = hashSecret(newPassword);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
    newHash,
    req.user.id,
  );

  return res.json({ message: "密码修改成功" });
});

// 查询当前用户是否有密钥
router.get("/me/secret", authenticate, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "未登录" });
  }

  const row = db
    .prepare("SELECT secret_hash FROM users WHERE id = ?")
    .get(req.user.id) as { secret_hash: string | null } | undefined;

  return res.json({ hasSecret: !!row?.secret_hash });
});

// 生成/重新生成密钥（返回明文密钥，仅此一次可见）
router.post("/me/secret", authenticate, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "未登录" });
  }

  // 生成随机密钥（32 字符）
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let secret = "";
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const secretHash = hashSecret(secret);

  db.prepare("UPDATE users SET secret_hash = ? WHERE id = ?").run(
    secretHash,
    req.user.id,
  );

  // 返回明文密钥（仅此一次可见）
  return res.json({ secret });
});

// 删除/关闭密钥
router.delete("/me/secret", authenticate, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "未登录" });
  }

  db.prepare("UPDATE users SET secret_hash = NULL WHERE id = ?").run(
    req.user.id,
  );

  return res.json({ message: "密钥已删除" });
});

// 管理员获取用户列表
router.get(
  "/users",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (_req, res) => {
    const rows = db
      .prepare(
        "SELECT id, username, role, created_at FROM users ORDER BY created_at DESC",
      )
      .all() as Array<{
      id: number;
      username: string;
      role: UserRole;
      created_at: string;
    }>;

    return res.json({ users: rows });
  },
);

// 管理员创建用户（支持设置密码和/或密钥）
router.post(
  "/users",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const { username, password, secret, role: requestedRole } = req.body as {
      username?: string;
      password?: string;
      secret?: string;
      role?: UserRole;
    };

    // 验证用户名
    if (!username || typeof username !== "string" || username.trim().length < 2) {
      return res.status(400).json({ message: "用户名至少需要 2 个字符" });
    }

    // 至少需要密码或密钥之一
    if ((!password || password.length < 6) && (!secret || secret.length < 6)) {
      return res.status(400).json({ message: "密码或密钥至少需要 6 个字符" });
    }

    const trimmedUsername = username.trim();

    // 检查用户名是否已存在
    const existing = db
      .prepare("SELECT id FROM users WHERE username = ?")
      .get(trimmedUsername);
    if (existing) {
      return res.status(409).json({ message: "用户名已存在" });
    }

    const role: UserRole = requestedRole === "admin" ? "admin" : "user";
    const passwordHash = password ? hashSecret(password) : null;
    const secretHash = secret ? hashSecret(secret) : null;

    const insert = db.prepare(
      "INSERT INTO users(username, password_hash, secret_hash, role) VALUES(?, ?, ?, ?)",
    );
    const result = insert.run(trimmedUsername, passwordHash, secretHash, role);

    const user = {
      id: Number(result.lastInsertRowid),
      username: trimmedUsername,
      role,
    } as const;

    return res.status(201).json({ user });
  },
);

// 管理员删除用户
router.delete(
  "/users/:id",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const userId = Number(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({ message: "无效的用户 ID" });
    }

    // 不能删除自己
    if (req.user?.id === userId) {
      return res.status(400).json({ message: "不能删除当前登录的账户" });
    }

    const existing = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
    if (!existing) {
      return res.status(404).json({ message: "用户不存在" });
    }

    db.prepare("DELETE FROM users WHERE id = ?").run(userId);

    return res.json({ message: "用户已删除" });
  },
);

// 管理员修改用户信息（角色、密码重置）
router.put(
  "/users/:id",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const userId = Number(req.params.id);
    const { role: newRole, password: newPassword } = req.body as {
      role?: UserRole;
      password?: string;
    };

    if (isNaN(userId)) {
      return res.status(400).json({ message: "无效的用户 ID" });
    }

    const existing = db
      .prepare("SELECT id, username, role FROM users WHERE id = ?")
      .get(userId) as { id: number; username: string; role: UserRole } | undefined;

    if (!existing) {
      return res.status(404).json({ message: "用户不存在" });
    }

    // 更新角色
    if (newRole && (newRole === "admin" || newRole === "user")) {
      db.prepare("UPDATE users SET role = ? WHERE id = ?").run(newRole, userId);
    }

    // 重置密码
    if (newPassword && newPassword.length >= 6) {
      const passwordHash = hashSecret(newPassword);
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
        passwordHash,
        userId,
      );
    }

    // 返回更新后的用户信息
    const updated = db
      .prepare("SELECT id, username, role, created_at FROM users WHERE id = ?")
      .get(userId) as {
      id: number;
      username: string;
      role: UserRole;
      created_at: string;
    };

    return res.json({ user: updated });
  },
);

export { router as authRouter };
