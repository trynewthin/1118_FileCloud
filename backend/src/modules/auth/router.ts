import express from "express";
import { db, initDatabase } from "../../core/db/index.ts";
import { hashSecret } from "../../core/security/hash.ts";
import { signUserToken } from "../../core/auth/jwt.ts";
import type { UserRole } from "../../core/auth/roles.ts";
import { PermissionLevel } from "../../core/auth/roles.ts";
import { authenticate, requirePermission } from "../../core/auth/permission.ts";

const router = express.Router();

// 系统是否已经初始化的标记 key
const SYSTEM_INITIALIZED_KEY = "system_initialized";

// 查询系统是否已初始化
const isSystemInitialized = (): boolean => {
  const row = db
    .prepare("SELECT value FROM system_config WHERE key = ?")
    .get(SYSTEM_INITIALIZED_KEY) as { value: string } | undefined;
  return row?.value === "true";
};

// 将系统标记为已初始化
const markSystemInitialized = () => {
  db.prepare(
    "INSERT INTO system_config(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(SYSTEM_INITIALIZED_KEY, "true");
};

// 初始化管理员账号
router.post("/init-admin", (req, res) => {
  const { username, secret } = req.body as {
    username?: string;
    secret?: string;
  };

  // 确保数据库表已创建
  initDatabase();

  if (isSystemInitialized()) {
    return res.status(400).json({ message: "系统已初始化，无法再次初始化管理员" });
  }

  if (!secret || typeof secret !== "string" || secret.length < 6) {
    return res
      .status(400)
      .json({ message: "密钥不能为空且长度至少为 6 位" });
  }

  const role: UserRole = "admin";
  const secretHash = hashSecret(secret);

  const insert = db.prepare(
    "INSERT INTO users(username, secret_hash, role) VALUES(?, ?, ?)",
  );

  const result = insert.run(username ?? null, secretHash, role);

  markSystemInitialized();

  const user = {
    id: Number(result.lastInsertRowid),
    username: username ?? null,
    role,
  } as const;

  const token = signUserToken(user);

  return res.json({
    user,
    token,
  });
});

// 使用密钥登录
router.post("/login", (req, res) => {
  const { secret } = req.body as { secret?: string };

  if (!secret || typeof secret !== "string") {
    return res.status(400).json({ message: "密钥不能为空" });
  }

  const secretHash = hashSecret(secret);

  const row = db
    .prepare(
      "SELECT id, username, role FROM users WHERE secret_hash = ? LIMIT 1",
    )
    .get(secretHash) as { id: number; username: string | null; role: UserRole } | undefined;

  if (!row) {
    return res.status(401).json({ message: "密钥错误或用户不存在" });
  }

  const user = {
    id: row.id,
    username: row.username,
    role: row.role,
  } as const;

  const token = signUserToken(user);

  return res.json({
    user,
    token,
  });
});

// 获取当前登录用户信息
router.get("/me", authenticate, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "未登录" });
  }

  return res.json({ user: req.user });
});

// 管理员创建普通用户密钥
router.post(
  "/users",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const { username, secret } = req.body as {
      username?: string;
      secret?: string;
    };

    if (!secret || typeof secret !== "string" || secret.length < 6) {
      return res
        .status(400)
        .json({ message: "密钥不能为空且长度至少为 6 位" });
    }

    const role: UserRole = "user";
    const secretHash = hashSecret(secret);

    const insert = db.prepare(
      "INSERT INTO users(username, secret_hash, role) VALUES(?, ?, ?)",
    );

    const result = insert.run(username ?? null, secretHash, role);

    const user = {
      id: Number(result.lastInsertRowid),
      username: username ?? null,
      role,
    } as const;

    // 出于安全考虑，这里不返回原始密钥，只返回用户信息
    return res.status(201).json({ user });
  },
);

export { router as authRouter };
