import express from "express";
import { createReadStream, type Stats } from "node:fs";
import { stat as statAsync } from "node:fs/promises";
import { authenticate, requirePermission } from "../../core/auth/permission.ts";
import { PermissionLevel } from "../../core/auth/roles.ts";
import { assertEntryAccess } from "../../core/auth/libraryAccess.ts";
import { withLibrary, withEntry, ensureLibraryEnabled } from "../../core/middleware/index.ts";
import { listEntriesByParentEnhanced, getEntryById, resolveRealPathForEntry, getEntryByIdIncludingDeleted, getEntryAncestors, listDeletedEntriesByLibrary, searchFolders } from "./service.ts";
import { searchByFts, getFtsIndexStats } from "./ftsService.ts";
import { getEntrySecurity, setEntryPassword, clearEntryPassword, checkEntryPasswordIfProtected } from "./security.ts";

import { createFolder, submitEntryCommand, submitIndexCommand } from "./application.ts";
import { receiveUpload } from "./uploadService.ts";

const router = express.Router();

function sendCommandError(res: express.Response, error: unknown) {
  const failure = error as { status?: number; message?: string };
  const status = failure?.status ?? 500;
  if (status >= 500) console.error("File command failed", error);
  if (!res.headersSent) res.status(status).json({ message: status >= 500 ? "文件操作失败" : failure.message });
}

// ============================================================================
// 文件库级别操作（使用 withLibrary 中间件统一校验）
// ============================================================================

// 新建文件夹（管理员权限）
router.post(
  "/library/:libraryId/mkdir",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  withLibrary(),
  async (req, res) => {
    try {
      return res.status(201).json((await createFolder(req.user, Number(req.params.libraryId), req.body)));
    } catch (error) {
      sendCommandError(res, error);
    }
  },
);

router.post(
  "/library/:libraryId/upload",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  withLibrary(),
  async (req, res) => {
    try {
      const result = await receiveUpload(req.user, Number(req.params.libraryId), req.query.parentId, req.headers, req);
      return res.status(201).json(result);
    } catch (error) {
      sendCommandError(res, error);
    }
  },
);

// 列出指定文件库下某个父节点的直接子项（普通登录用户可用）
const handleListEntries: express.RequestHandler = async (req, res) => {
    const libraryId = Number(req.params.libraryId);
    if (!Number.isInteger(libraryId) || libraryId <= 0) {
      return res.status(400).json({ message: "文件库 ID 不合法" });
    }

    const check = (await ensureLibraryEnabled(libraryId));
    if (!check.ok) {
      return res.status(404).json({ message: check.message });
    }

    const input = req.method === "POST" ? req.body : req.query;
    if (input !== undefined && (!input || typeof input !== "object" || Array.isArray(input))) {
      return res.status(400).json({ message: "请求参数不合法" });
    }
    const { parentId, password } = input ?? {};
    if ((parentId != null && (typeof parentId !== "string" || !parentId)) ||
        (password != null && typeof password !== "string")) {
      return res.status(400).json({ message: "目录或密码参数不合法" });
    }

    // Authorize the parent before inspecting protection or listing children.
    if (parentId) {
      try {
        (await assertEntryAccess(req.user, parentId, { libraryId, directory: true }));
      } catch (err: any) {
        return res.status(err.status ?? 403).json({ message: err.message });
      }
      const checkPwd = checkEntryPasswordIfProtected(parentId, password);
      if (!checkPwd.ok) {
        return res.status(403).json({ message: checkPwd.message ?? "访问密码错误" });
      }
    }

    // 使用增强版列表函数，返回库在线状态
    const result = (await listEntriesByParentEnhanced({
      libraryId,
      parentId: parentId ?? null,
    }));

    return res.json({
      items: result.items,
      library_online: result.library_online,
    });
};
// Credentialed read-only POST keeps passwords out of URLs; GET stays compatible.
for (const method of ["get", "post"] as const) {
  router[method]("/library/:libraryId/entries", authenticate,
    requirePermission(PermissionLevel.User), withLibrary(), handleListEntries);
}

// 全文搜索文件和目录（使用 FTS5，普通登录用户可用）
router.get(
  "/library/:libraryId/search",
  authenticate,
  requirePermission(PermissionLevel.User),
  withLibrary(),
  async (req, res) => {
    const libraryId = Number(req.params.libraryId);
    if (!Number.isInteger(libraryId) || libraryId <= 0) {
      return res.status(400).json({ message: "文件库 ID 不合法" });
    }

    const check = (await ensureLibraryEnabled(libraryId));
    if (!check.ok) {
      return res.status(404).json({ message: check.message });
    }

    const { q, pathPrefix, extension, type, limit } = req.query as {
      q?: string;
      pathPrefix?: string;
      extension?: string;
      type?: "all" | "file" | "directory";
      limit?: string;
    };

    if (!q || q.trim().length === 0) {
      return res.json({ items: [] });
    }

    const items = searchByFts({
      libraryId,
      keyword: q,
      pathPrefix,
      extension,
      type: type || "all",
      limit: limit ? Math.min(parseInt(limit, 10), 100) : 50,
    });

    return res.json({ items });
  },
);

// 获取 FTS 索引统计信息（管理员可用）
router.get(
  "/library/:libraryId/search/stats",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  withLibrary(),
  (req, res) => {
    const libraryId = Number(req.params.libraryId);
    if (!Number.isInteger(libraryId) || libraryId <= 0) {
      return res.status(400).json({ message: "文件库 ID 不合法" });
    }

    const stats = getFtsIndexStats(libraryId);
    return res.json(stats);
  },
);

// 搜索文件库中的文件夹（普通登录用户可用）
router.get(
  "/library/:libraryId/folders/search",
  authenticate,
  requirePermission(PermissionLevel.User),
  withLibrary(),
  async (req, res) => {
    const libraryId = Number(req.params.libraryId);
    if (!Number.isInteger(libraryId) || libraryId <= 0) {
      return res.status(400).json({ message: "文件库 ID 不合法" });
    }

    const check = (await ensureLibraryEnabled(libraryId));
    if (!check.ok) {
      return res.status(404).json({ message: check.message });
    }

    const { keyword, excludeId, limit } = req.query as { 
      keyword?: string; 
      excludeId?: string;
      limit?: string;
    };

    if (!keyword || keyword.trim().length === 0) {
      return res.json({ items: [] });
    }

    const items = searchFolders({
      libraryId,
      keyword,
      excludeId,
      limit: limit ? Math.min(parseInt(limit, 10), 50) : 20,
    });

    return res.json({ items });
  },
);

// 列出指定文件库的回收站条目（仅管理员可用）
router.get(
  "/library/:libraryId/trash",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  withLibrary(),
  async (req, res) => {
    const libraryId = Number(req.params.libraryId);
    if (!Number.isInteger(libraryId) || libraryId <= 0) {
      return res.status(400).json({ message: "文件库 ID 不合法" });
    }

    const check = (await ensureLibraryEnabled(libraryId));
    if (!check.ok) {
      return res.status(404).json({ message: check.message });
    }

    const items = (await listDeletedEntriesByLibrary(libraryId));
    return res.json({ items });
  },
);

// 触发重命名任务（管理员权限）
router.post(
  "/entries/:id/rename",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  withEntry(),
  async (req, res) => {
    try {
      return res.status(201).json({ task: (await submitEntryCommand(req.user, req.params.id, "rename", req.body)) });
    } catch (error) {
      sendCommandError(res, error);
    }
  },
);

// 触发移动任务（管理员权限）
router.post(
  "/entries/:id/move",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  withEntry(),
  async (req, res) => {
    try {
      return res.status(201).json({ task: (await submitEntryCommand(req.user, req.params.id, "move", req.body)) });
    } catch (error) {
      sendCommandError(res, error);
    }
  },
);

// 触发复制任务（管理员权限，目前仅支持复制文件）
router.post(
  "/entries/:id/copy",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  withEntry(),
  async (req, res) => {
    try {
      return res.status(201).json({ task: (await submitEntryCommand(req.user, req.params.id, "copy", req.body)) });
    } catch (error) {
      sendCommandError(res, error);
    }
  },
);

// 下载文件内容（普通登录用户可用，目录不支持下载）
const handleDownload = async (req: express.Request, res: express.Response) => {
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

    const check = (await ensureLibraryEnabled(entry.library_id));
    if (!check.ok) {
      return res.status(404).json({ message: check.message });
    }

    const pwd = (req.query as { password?: string }).password;
    const checkPwd = checkEntryPasswordIfProtected(id, pwd);
    if (!checkPwd.ok) {
      return res.status(403).json({ message: checkPwd.message ?? "访问密码错误" });
    }

    const realPath = (await resolveRealPathForEntry(entry, check.library.rootPath));

    let stat: Stats;
    try {
      stat = (await statAsync(realPath));
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

      const stream = createReadStream(realPath, { start, end });

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

    const stream = createReadStream(realPath);

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
  withEntry(),
  handleDownload,
);

router.get(
  "/entries/:id/download/:filename",
  authenticate,
  requirePermission(PermissionLevel.User),
  withEntry(),
  handleDownload,
);

// 查询单个文件索引详情（普通登录用户可用）
const handleEntryDetail: express.RequestHandler = (req, res) => {
    const { id } = req.params;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ message: "文件索引 ID 不合法" });
    }

    const entry = getEntryById(id);
    if (!entry) {
      return res.status(404).json({ message: "文件或目录不存在" });
    }

    const input = req.method === "POST" ? req.body : req.query;
    if (input !== undefined && (!input || typeof input !== "object" || Array.isArray(input))) {
      return res.status(400).json({ message: "请求参数不合法" });
    }
    const pwd = input?.password;
    if (pwd != null && typeof pwd !== "string") {
      return res.status(400).json({ message: "密码参数不合法" });
    }
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
};
for (const method of ["get", "post"] as const) {
  router[method]("/entries/:id", authenticate,
    requirePermission(PermissionLevel.User), withEntry(), handleEntryDetail);
}

// 为条目设置或更新访问密码（管理员权限）
router.post(
  "/entries/:id/password",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  withEntry({ includeDeleted: true }),
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
  withEntry({ includeDeleted: true }),
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
  withEntry(),
  async (req, res) => {
    try {
      return res.status(201).json({ task: (await submitEntryCommand(req.user, req.params.id, "delete", req.body)) });
    } catch (error) {
      sendCommandError(res, error);
    }
  },
);

// 触发单个条目的还原任务（从回收站恢复，管理员权限）
router.post(
  "/entries/:id/restore",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  withEntry({ includeDeleted: true }),
  async (req, res) => {
    try {
      return res.status(201).json({ task: (await submitEntryCommand(req.user, req.params.id, "restore", req.body)) });
    } catch (error) {
      sendCommandError(res, error);
    }
  },
);

// 触发单个条目的彻底删除任务（从回收站清理物理文件，管理员权限）
router.post(
  "/entries/:id/destroy",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  withEntry({ includeDeleted: true }),
  async (req, res) => {
    try {
      return res.status(201).json({ task: (await submitEntryCommand(req.user, req.params.id, "destroy", req.body)) });
    } catch (error) {
      sendCommandError(res, error);
    }
  },
);

// 触发指定文件库的全量索引任务（管理员权限）
// 支持 forceReindex 参数：强制重建所有索引（先标记所有现有索引为已删除，再重新扫描）
router.post(
  "/library/:libraryId/index",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  withLibrary(),
  async (req, res) => {
    try {
      return res.status(201).json({ task: (await submitIndexCommand(req.user, Number(req.params.libraryId), "library", req.body)) });
    } catch (error) {
      sendCommandError(res, error);
    }
  },
);

// 触发单路径索引任务（管理员权限），用于小范围刷新
router.post(
  "/library/:libraryId/index-path",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  withLibrary(),
  async (req, res) => {
    try {
      return res.status(201).json({ task: (await submitIndexCommand(req.user, Number(req.params.libraryId), "path", req.body)) });
    } catch (error) {
      sendCommandError(res, error);
    }
  },
);

export { router as filesRouter };
