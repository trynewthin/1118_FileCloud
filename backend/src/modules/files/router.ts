import express from "express";
import fs from "node:fs";
import path from "node:path";
import Busboy from "busboy";
import { authenticate, requirePermission } from "../../core/auth/permission.ts";
import { PermissionLevel } from "../../core/auth/roles.ts";
import { db } from "../../core/db/index.ts";
import { listEntriesByParent, getEntryById, resolveRealPathForEntry, getEntryByIdIncludingDeleted, getEntryAncestors, listDeletedEntriesByLibrary } from "./service.ts";
import { createTask } from "../tasks/service.ts";
import { TASK_TYPE_FILE_INDEX_LIBRARY, TASK_TYPE_FILE_INDEX_SINGLE } from "./indexTasks.ts";
import { TASK_TYPE_FILE_DELETE_ENTRY, TASK_TYPE_FILE_RESTORE_ENTRY, TASK_TYPE_FILE_DESTROY_ENTRY, TASK_TYPE_FILE_RENAME_ENTRY, TASK_TYPE_FILE_MOVE_ENTRY, TASK_TYPE_FILE_COPY_ENTRY } from "./fileOpsTasks.ts";
import { getEntrySecurity, setEntryPassword, clearEntryPassword, checkEntryPasswordIfProtected } from "./security.ts";

const router = express.Router();

// 校验文件库是否存在且已启用
const ensureLibraryEnabled = (libraryId: number) => {
  const row = db
    .prepare(
      "SELECT id, root_path, is_enabled FROM file_libraries WHERE id = ? LIMIT 1",
    )
    .get(libraryId) as { id: number; root_path: string; is_enabled: number } | undefined;

  if (!row) {
    return { ok: false as const, message: "文件库不存在" };
  }

  if (!row.is_enabled) {
    return { ok: false as const, message: "文件库未启用" };
  }

  return { ok: true as const, library: row };
};

router.post(
  "/library/:libraryId/upload",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const libraryId = Number(req.params.libraryId);
    if (!Number.isInteger(libraryId) || libraryId <= 0) {
      return res.status(400).json({ message: "文件库 ID 不合法" });
    }

    const check = ensureLibraryEnabled(libraryId);
    if (!check.ok) {
      return res.status(404).json({ message: check.message });
    }

    const parentId = (req.query as { parentId?: string }).parentId ?? null;

    let targetDir = check.library.root_path;

    if (parentId) {
      const parentEntry = getEntryById(parentId);
      if (!parentEntry) {
        return res.status(404).json({ message: "父目录不存在" });
      }
      if (!parentEntry.is_directory) {
        return res.status(400).json({ message: "父条目不是目录" });
      }
      if (parentEntry.library_id !== libraryId) {
        return res.status(400).json({ message: "父目录不属于当前文件库" });
      }

      const relative = resolveRealPathForEntry(parentEntry, check.library.root_path);
      targetDir = relative;
    }

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const bb = Busboy({ headers: req.headers });

    type SavedFile = { filename: string; size: number };
    const saved: SavedFile[] = [];
    let hasFile = false;
    let errorOccurred = false;

    bb.on("file", (_fieldname, file, info) => {
      hasFile = true;
      let original = info.filename || "unnamed";
      try {
        const buf = Buffer.from(original, "latin1");
        const decoded = buf.toString("utf8");
        if (decoded && !decoded.includes("�")) {
          original = decoded;
        }
      } catch {
        // 保底失败则继续使用原始文件名
      }
      const base = original.replace(/[\\/:*?"<>|]/g, "_");
      const ext = path.extname(base);
      const nameWithoutExt = path.basename(base, ext);
      let candidate = base;
      let index = 1;
      while (fs.existsSync(path.join(targetDir, candidate))) {
        candidate = `${nameWithoutExt}(${index})${ext}`;
        index += 1;
      }

      const destPath = path.join(targetDir, candidate);
      const write = fs.createWriteStream(destPath);
      let size = 0;

      file.on("data", (data) => {
        size += data.length;
      });

      file.on("error", () => {
        errorOccurred = true;
        write.destroy();
      });

      write.on("error", () => {
        errorOccurred = true;
        file.resume();
      });

      write.on("close", () => {
        if (!errorOccurred) {
          saved.push({ filename: candidate, size });
        }
      });

      file.pipe(write);
    });

    bb.on("error", () => {
      errorOccurred = true;
      return res.status(500).json({ message: "上传失败" });
    });

    bb.on("finish", () => {
      if (errorOccurred) {
        return;
      }

      if (!hasFile) {
        return res.status(400).json({ message: "未收到任何文件" });
      }

      const relativePath = path.relative(check.library.root_path, targetDir);
      const userId = req.user?.id ?? null;

      const task = createTask({
        type: relativePath === "" ? TASK_TYPE_FILE_INDEX_LIBRARY : TASK_TYPE_FILE_INDEX_SINGLE,
        payload:
          relativePath === ""
            ? { libraryId }
            : { libraryId, relativePath },
        createdByUserId: userId,
      });

      return res.status(201).json({ uploaded: saved.length, task });
    });

    req.pipe(bb);
  },
);

// 列出指定文件库下某个父节点的直接子项（普通登录用户可用）
router.get(
  "/library/:libraryId/entries",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    const libraryId = Number(req.params.libraryId);
    if (!Number.isInteger(libraryId) || libraryId <= 0) {
      return res.status(400).json({ message: "文件库 ID 不合法" });
    }

    const check = ensureLibraryEnabled(libraryId);
    if (!check.ok) {
      return res.status(404).json({ message: check.message });
    }

    const { parentId, password } = req.query as { parentId?: string; password?: string };

    // 如果是查看某个加密目录下的内容，则需要校验目录密码
    if (parentId) {
      const checkPwd = checkEntryPasswordIfProtected(parentId, password);
      if (!checkPwd.ok) {
        return res.status(403).json({ message: checkPwd.message ?? "访问密码错误" });
      }
    }

    const items = listEntriesByParent({
      libraryId,
      parentId: parentId ?? null,
    });

    return res.json({ items });
  },
);

// 列出指定文件库的回收站条目（仅管理员可用）
router.get(
  "/library/:libraryId/trash",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const libraryId = Number(req.params.libraryId);
    if (!Number.isInteger(libraryId) || libraryId <= 0) {
      return res.status(400).json({ message: "文件库 ID 不合法" });
    }

    const check = ensureLibraryEnabled(libraryId);
    if (!check.ok) {
      return res.status(404).json({ message: check.message });
    }

    const items = listDeletedEntriesByLibrary(libraryId);
    return res.json({ items });
  },
);

// 触发重命名任务（管理员权限）
router.post(
  "/entries/:id/rename",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const { id } = req.params;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ message: "文件索引 ID 不合法" });
    }

    const entry = getEntryById(id);
    if (!entry) {
      return res.status(404).json({ message: "文件或目录不存在" });
    }

    const { newName, password } = req.body as { newName?: string; password?: string };

    if (!newName || typeof newName !== "string" || newName.trim().length === 0) {
      return res.status(400).json({ message: "新名称不能为空" });
    }

    const checkPwd = checkEntryPasswordIfProtected(id, password);
    if (!checkPwd.ok) {
      return res.status(403).json({ message: checkPwd.message ?? "访问密码错误" });
    }

    const userId = req.user?.id ?? null;

    const task = createTask({
      type: TASK_TYPE_FILE_RENAME_ENTRY,
      payload: { entryId: id, newName },
      createdByUserId: userId,
    });

    return res.status(201).json({ task });
  },
);

// 触发移动任务（管理员权限）
router.post(
  "/entries/:id/move",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const { id } = req.params;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ message: "文件索引 ID 不合法" });
    }

    const entry = getEntryById(id);
    if (!entry) {
      return res.status(404).json({ message: "文件或目录不存在" });
    }

    const { targetParentId, password } = req.body as {
      targetParentId?: string | null;
      password?: string;
    };

    const checkPwd = checkEntryPasswordIfProtected(id, password);
    if (!checkPwd.ok) {
      return res.status(403).json({ message: checkPwd.message ?? "访问密码错误" });
    }

    const userId = req.user?.id ?? null;

    const task = createTask({
      type: TASK_TYPE_FILE_MOVE_ENTRY,
      payload: { entryId: id, targetParentId: targetParentId ?? null },
      createdByUserId: userId,
    });

    return res.status(201).json({ task });
  },
);

// 触发复制任务（管理员权限，目前仅支持复制文件）
router.post(
  "/entries/:id/copy",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const { id } = req.params;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ message: "文件索引 ID 不合法" });
    }

    const entry = getEntryById(id);
    if (!entry) {
      return res.status(404).json({ message: "文件或目录不存在" });
    }

    if (entry.is_directory) {
      return res.status(400).json({ message: "暂不支持目录复制" });
    }

    const { targetParentId, newName, password } = req.body as {
      targetParentId?: string | null;
      newName?: string;
      password?: string;
    };

    const checkPwd = checkEntryPasswordIfProtected(id, password);
    if (!checkPwd.ok) {
      return res.status(403).json({ message: checkPwd.message ?? "访问密码错误" });
    }

    const userId = req.user?.id ?? null;

    const task = createTask({
      type: TASK_TYPE_FILE_COPY_ENTRY,
      payload: { entryId: id, targetParentId: targetParentId ?? null, newName },
      createdByUserId: userId,
    });

    return res.status(201).json({ task });
  },
);

// 下载文件内容（普通登录用户可用，目录不支持下载）
const handleDownload = (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ message: "文件索引 ID 不合法" });
    }

    const entry = getEntryById(id);
    if (!entry) {
      return res.status(404).json({ message: "文件不存在或已删除" });
    }

    if (entry.is_directory) {
      return res.status(400).json({ message: "不支持直接下载目录" });
    }

    const check = ensureLibraryEnabled(entry.library_id);
    if (!check.ok) {
      return res.status(404).json({ message: check.message });
    }

    const pwd = (req.query as { password?: string }).password;
    const checkPwd = checkEntryPasswordIfProtected(id, pwd);
    if (!checkPwd.ok) {
      return res.status(403).json({ message: checkPwd.message ?? "访问密码错误" });
    }

    const realPath = resolveRealPathForEntry(entry, check.library.root_path);

    let stat: fs.Stats;
    try {
      stat = fs.statSync(realPath);
    } catch (err) {
      return res.status(500).json({ message: "文件下载失败" });
    }

    const fileSize = stat.size;
    const range = req.headers.range as string | undefined;

    const rawName = entry.original_name;
    const asciiSafeName = rawName
      .split("")
      .map((ch) => {
        const code = ch.charCodeAt(0);
        if (code < 0x20 || code > 0x7e || ch === '"' || ch === "\\") {
          return "_";
        }
        return ch;
      })
      .join("");
    const fallbackName = asciiSafeName || "download";
    const encodedName = encodeURIComponent(rawName);

    const setCommonHeaders = () => {
      res.setHeader("Content-Type", entry.mime_type || "application/octet-stream");
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`,
      );
    };

    // 支持 Range 请求，提升视频在 iOS 上的播放流畅度
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match) {
        return res.status(416).end();
      }

      let start = match[1] ? parseInt(match[1], 10) : 0;
      let end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

      if (isNaN(start) || isNaN(end) || start > end || start >= fileSize) {
        return res.status(416).end();
      }

      end = Math.min(end, fileSize - 1);
      const chunkSize = end - start + 1;

      res.status(206);
      setCommonHeaders();
      res.setHeader("Content-Length", String(chunkSize));
      res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);

      const stream = fs.createReadStream(realPath, { start, end });

      stream.on("error", (err) => {
        console.error("file download stream error", err);
        if (!res.headersSent) {
          res.status(500).json({ message: "文件下载失败" });
        } else {
          res.destroy(err as any);
        }
      });

      req.on("aborted", () => {
        stream.destroy();
      });

      return stream.pipe(res);
    }

    // 非 Range 请求，整体下载
    res.status(200);
    setCommonHeaders();
    res.setHeader("Content-Length", String(fileSize));

    const stream = fs.createReadStream(realPath);

    stream.on("error", (err) => {
      console.error("file download stream error", err);
      if (!res.headersSent) {
        res.status(500).json({ message: "文件下载失败" });
      } else {
        res.destroy(err as any);
      }
    });

    req.on("aborted", () => {
      stream.destroy();
    });

    stream.pipe(res);
  };

router.get(
  "/entries/:id/download",
  authenticate,
  requirePermission(PermissionLevel.User),
  handleDownload,
);

router.get(
  "/entries/:id/download/:filename",
  authenticate,
  requirePermission(PermissionLevel.User),
  handleDownload,
);

// 查询单个文件索引详情（普通登录用户可用）
router.get(
  "/entries/:id",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    const { id } = req.params;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ message: "文件索引 ID 不合法" });
    }

    const entry = getEntryById(id);
    if (!entry) {
      return res.status(404).json({ message: "文件或目录不存在" });
    }

    const pwd = (req.query as { password?: string }).password;
    const checkPwd = checkEntryPasswordIfProtected(id, pwd);
    if (!checkPwd.ok) {
      return res.status(403).json({ message: checkPwd.message ?? "访问密码错误" });
    }

    const security = getEntrySecurity(id);
    const ancestors = getEntryAncestors(entry);

    return res.json({
      entry,
      ancestors,
      security: security
        ? {
            hasPassword: true,
            hint: security.hint,
          }
        : { hasPassword: false },
    });
  },
);

// 为条目设置或更新访问密码（管理员权限）
router.post(
  "/entries/:id/password",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const { id } = req.params;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ message: "文件索引 ID 不合法" });
    }

    const entry = getEntryByIdIncludingDeleted(id);
    if (!entry) {
      return res.status(404).json({ message: "文件或目录不存在" });
    }

    const { password, hint } = req.body as { password?: string; hint?: string };

    if (!password || typeof password !== "string" || password.length === 0) {
      return res.status(400).json({ message: "密码不能为空" });
    }

    const security = setEntryPassword(id, password, hint);

    return res.json({
      security: {
        hasPassword: true,
        hint: security.hint,
      },
    });
  },
);

// 清除条目的访问密码（管理员权限）
router.delete(
  "/entries/:id/password",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const { id } = req.params;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ message: "文件索引 ID 不合法" });
    }

    const entry = getEntryByIdIncludingDeleted(id);
    if (!entry) {
      return res.status(404).json({ message: "文件或目录不存在" });
    }

    clearEntryPassword(id);

    return res.status(204).send();
  },
);

// 触发单个条目的删除任务（移动到回收站，管理员权限）
router.post(
  "/entries/:id/delete",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const { id } = req.params;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ message: "文件索引 ID 不合法" });
    }

    const entry = getEntryById(id);
    if (!entry) {
      return res.status(404).json({ message: "文件或目录不存在" });
    }

    const check = ensureLibraryEnabled(entry.library_id);
    if (!check.ok) {
      return res.status(404).json({ message: check.message });
    }

    const { password } = req.body as { password?: string };

    const checkPwd = checkEntryPasswordIfProtected(id, password);
    if (!checkPwd.ok) {
      return res.status(403).json({ message: checkPwd.message ?? "访问密码错误" });
    }

    const userId = req.user?.id ?? null;

    const task = createTask({
      type: TASK_TYPE_FILE_DELETE_ENTRY,
      payload: { entryId: id },
      createdByUserId: userId,
    });

    return res.status(201).json({ task });
  },
);

// 触发单个条目的还原任务（从回收站恢复，管理员权限）
router.post(
  "/entries/:id/restore",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const { id } = req.params;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ message: "文件索引 ID 不合法" });
    }

    const entry = getEntryByIdIncludingDeleted(id);
    if (!entry) {
      return res.status(404).json({ message: "文件或目录不存在" });
    }

    if (!entry.is_deleted) {
      return res.status(400).json({ message: "文件或目录未被删除" });
    }

    const check = ensureLibraryEnabled(entry.library_id);
    if (!check.ok) {
      return res.status(404).json({ message: check.message });
    }

    const userId = req.user?.id ?? null;

    const task = createTask({
      type: TASK_TYPE_FILE_RESTORE_ENTRY,
      payload: { entryId: id },
      createdByUserId: userId,
    });

    return res.status(201).json({ task });
  },
);

// 触发单个条目的彻底删除任务（从回收站清理物理文件，管理员权限）
router.post(
  "/entries/:id/destroy",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const { id } = req.params;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ message: "文件索引 ID 不合法" });
    }

    const entry = getEntryByIdIncludingDeleted(id);
    if (!entry) {
      return res.status(404).json({ message: "文件或目录不存在" });
    }

    if (!entry.is_deleted) {
      return res.status(400).json({ message: "仅支持对已删除条目执行彻底删除" });
    }

    const check = ensureLibraryEnabled(entry.library_id);
    if (!check.ok) {
      return res.status(404).json({ message: check.message });
    }

    const userId = req.user?.id ?? null;

    const task = createTask({
      type: TASK_TYPE_FILE_DESTROY_ENTRY,
      payload: { entryId: id },
      createdByUserId: userId,
    });

    return res.status(201).json({ task });
  },
);

// 触发指定文件库的全量索引任务（管理员权限）
// 支持 forceReindex 参数：强制重建所有索引（先标记所有现有索引为已删除，再重新扫描）
router.post(
  "/library/:libraryId/index",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const libraryId = Number(req.params.libraryId);
    if (!Number.isInteger(libraryId) || libraryId <= 0) {
      return res.status(400).json({ message: "文件库 ID 不合法" });
    }

    const { forceReindex } = req.body as { forceReindex?: boolean };

    const check = ensureLibraryEnabled(libraryId);
    if (!check.ok) {
      return res.status(404).json({ message: check.message });
    }

    const userId = req.user?.id ?? null;

    const task = createTask({
      type: TASK_TYPE_FILE_INDEX_LIBRARY,
      payload: { libraryId, forceReindex: forceReindex === true },
      createdByUserId: userId,
    });

    return res.status(201).json({ task });
  },
);

// 触发单路径索引任务（管理员权限），用于小范围刷新
router.post(
  "/library/:libraryId/index-path",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const libraryId = Number(req.params.libraryId);
    if (!Number.isInteger(libraryId) || libraryId <= 0) {
      return res.status(400).json({ message: "文件库 ID 不合法" });
    }

    const { relativePath } = req.body as { relativePath?: string };

    if (!relativePath || typeof relativePath !== "string") {
      return res.status(400).json({ message: "相对路径不能为空" });
    }

    const check = ensureLibraryEnabled(libraryId);
    if (!check.ok) {
      return res.status(404).json({ message: check.message });
    }

    const userId = req.user?.id ?? null;

    const task = createTask({
      type: TASK_TYPE_FILE_INDEX_SINGLE,
      payload: { libraryId, relativePath },
      createdByUserId: userId,
    });

    return res.status(201).json({ task });
  },
);

export { router as filesRouter };
