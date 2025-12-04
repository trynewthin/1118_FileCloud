import { db } from "../../core/db/index.ts";

// ============================================================================
// 类型定义
// ============================================================================

export interface FileTag {
  id: number;
  user_id: number;  // 所属用户 ID（全局标签系统）
  name: string;
  parent_tag_id: number | null;
  level: number;
  color: string | null;
  allow_multiple: boolean;  // 仅一级标签有效：是否允许多选
  sort_order: number;
  created_at: string;
  updated_at: string;
  // 查询时可选填充
  children?: FileTag[];
  entry_count?: number;
}

export interface FileTagEntry {
  id: number;
  tag_id: number;
  entry_id: string;
  is_primary: boolean;
  created_at: string;
}

// ============================================================================
// 内部工具函数
// ============================================================================

// 将数据库行转换为标签对象
const mapRowToTag = (row: any): FileTag => ({
  id: row.id,
  user_id: row.user_id,
  name: row.name,
  parent_tag_id: row.parent_tag_id ?? null,
  level: row.level,
  color: row.color ?? null,
  allow_multiple: Boolean(row.allow_multiple),
  sort_order: row.sort_order ?? 0,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

// 将数据库行转换为标签关联对象
const mapRowToTagEntry = (row: any): FileTagEntry => ({
  id: row.id,
  tag_id: row.tag_id,
  entry_id: row.entry_id,
  is_primary: Boolean(row.is_primary),
  created_at: row.created_at,
});

// ============================================================================
// 标签 CRUD
// ============================================================================

// 获取单个标签
export const getTagById = (id: number): FileTag | null => {
  const row = db
    .prepare("SELECT * FROM file_tags WHERE id = ?")
    .get(id) as any | undefined;
  if (!row) return null;
  return mapRowToTag(row);
};

// 获取单个标签（限定用户）
export const getTagByIdForUser = (id: number, userId: number): FileTag | null => {
  const row = db
    .prepare("SELECT * FROM file_tags WHERE id = ? AND user_id = ?")
    .get(id, userId) as any | undefined;
  if (!row) return null;
  return mapRowToTag(row);
};

// 获取用户的所有标签（树形结构）
export const listAllTags = (userId: number): FileTag[] => {
  const rows = db
    .prepare("SELECT * FROM file_tags WHERE user_id = ? ORDER BY level ASC, sort_order ASC, name ASC")
    .all(userId) as any[];
  
  const tags = rows.map(mapRowToTag);
  
  // 构建树形结构
  const tagMap = new Map<number, FileTag>();
  const rootTags: FileTag[] = [];
  
  for (const tag of tags) {
    tag.children = [];
    tagMap.set(tag.id, tag);
  }
  
  for (const tag of tags) {
    if (tag.parent_tag_id === null) {
      rootTags.push(tag);
    } else {
      const parent = tagMap.get(tag.parent_tag_id);
      if (parent) {
        parent.children!.push(tag);
      }
    }
  }
  
  return rootTags;
};

// 获取用户的所有标签（扁平列表）
export const listAllTagsFlat = (userId: number): FileTag[] => {
  const rows = db
    .prepare("SELECT * FROM file_tags WHERE user_id = ? ORDER BY level ASC, sort_order ASC, name ASC")
    .all(userId) as any[];
  return rows.map(mapRowToTag);
};

// 获取用户指定父标签下的子标签
export const listChildTags = (userId: number, parentTagId: number | null): FileTag[] => {
  const rows = parentTagId === null
    ? db.prepare("SELECT * FROM file_tags WHERE user_id = ? AND parent_tag_id IS NULL ORDER BY sort_order ASC, name ASC").all(userId) as any[]
    : db.prepare("SELECT * FROM file_tags WHERE user_id = ? AND parent_tag_id = ? ORDER BY sort_order ASC, name ASC").all(userId, parentTagId) as any[];
  return rows.map(mapRowToTag);
};

// 创建标签
export interface CreateTagInput {
  userId: number;  // 所属用户
  name: string;
  parentTagId?: number | null;
  color?: string | null;
  allowMultiple?: boolean;
  sortOrder?: number;
}

export const createTag = (input: CreateTagInput): FileTag => {
  const { userId, name, parentTagId, color, allowMultiple, sortOrder } = input;
  
  // 计算层级
  let level = 1;
  if (parentTagId) {
    const parent = getTagByIdForUser(parentTagId, userId);
    if (!parent) {
      throw new Error("父标签不存在");
    }
    if (parent.level >= 3) {
      throw new Error("标签层级不能超过 3 层");
    }
    level = parent.level + 1;
  }
  
  // 检查同用户同级同名
  let existing: any | undefined;
  if (parentTagId === null) {
    existing = db.prepare("SELECT id FROM file_tags WHERE user_id = ? AND parent_tag_id IS NULL AND name = ?").get(userId, name.trim());
  } else {
    existing = db.prepare("SELECT id FROM file_tags WHERE user_id = ? AND parent_tag_id = ? AND name = ?").get(userId, parentTagId ?? null, name.trim());
  }
  
  if (existing) {
    throw new Error("同级下已存在同名标签");
  }
  
  const now = new Date().toISOString();
  
  const result = db
    .prepare(
      "INSERT INTO file_tags (user_id, name, parent_tag_id, level, color, allow_multiple, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      userId,
      name.trim(),
      parentTagId ?? null,
      level,
      color ?? null,
      level === 1 ? (allowMultiple ? 1 : 0) : 0, // 仅一级标签可设置 allow_multiple
      sortOrder ?? 0,
      now,
      now
    );
  
  return getTagById(Number(result.lastInsertRowid))!;
};

// 更新标签
export interface UpdateTagInput {
  name?: string;
  color?: string | null;
  allowMultiple?: boolean;
  sortOrder?: number;
}

export const updateTag = (id: number, userId: number, input: UpdateTagInput): FileTag => {
  const tag = getTagByIdForUser(id, userId);
  if (!tag) {
    throw new Error("标签不存在");
  }
  
  const { name, color, allowMultiple, sortOrder } = input;
  
  // 如果修改名称，检查同用户同级同名
  if (name !== undefined && name.trim() !== tag.name) {
    const existing = tag.parent_tag_id === null
      ? db.prepare("SELECT id FROM file_tags WHERE user_id = ? AND parent_tag_id IS NULL AND name = ? AND id != ?").get(userId, name.trim(), id) as any | undefined
      : db.prepare("SELECT id FROM file_tags WHERE user_id = ? AND parent_tag_id = ? AND name = ? AND id != ?").get(userId, tag.parent_tag_id, name.trim(), id) as any | undefined;
    
    if (existing) {
      throw new Error("同级下已存在同名标签");
    }
  }
  
  const now = new Date().toISOString();
  
  db.prepare(
    "UPDATE file_tags SET name = ?, color = ?, allow_multiple = ?, sort_order = ?, updated_at = ? WHERE id = ?"
  ).run(
    name !== undefined ? name.trim() : tag.name,
    color !== undefined ? color : tag.color,
    tag.level === 1 && allowMultiple !== undefined ? (allowMultiple ? 1 : 0) : (tag.allow_multiple ? 1 : 0),
    sortOrder !== undefined ? sortOrder : tag.sort_order,
    now,
    id
  );
  
  return getTagById(id)!;
};

// 删除标签（级联删除子标签和关联）
export const deleteTag = (id: number, userId: number): void => {
  const tag = getTagByIdForUser(id, userId);
  if (!tag) {
    throw new Error("标签不存在");
  }
  
  // 递归获取所有子标签 ID
  const getAllDescendantIds = (parentId: number): number[] => {
    const children = db
      .prepare("SELECT id FROM file_tags WHERE parent_tag_id = ?")
      .all(parentId) as { id: number }[];
    
    const ids: number[] = [];
    for (const child of children) {
      ids.push(child.id);
      ids.push(...getAllDescendantIds(child.id));
    }
    return ids;
  };
  
  const descendantIds = getAllDescendantIds(id);
  const allIds = [id, ...descendantIds];
  
  // 删除所有关联
  const placeholders = allIds.map(() => "?").join(",");
  db.prepare(`DELETE FROM file_tag_entries WHERE tag_id IN (${placeholders})`).run(...allIds);
  
  // 删除所有标签（从子到父）
  db.prepare(`DELETE FROM file_tags WHERE id IN (${placeholders})`).run(...allIds);
};

// ============================================================================
// 文件-标签关联
// ============================================================================

// 获取标签的一级祖先（用于判断互斥模式）
export const getRootAncestor = (tagId: number): FileTag | null => {
  let current = getTagById(tagId);
  if (!current) return null;
  
  while (current.parent_tag_id !== null) {
    const parent = getTagById(current.parent_tag_id);
    if (!parent) break;
    current = parent;
  }
  
  return current;
};

// 获取文件的所有标签
export const getTagsForEntry = (entryId: string): (FileTagEntry & { tag: FileTag })[] => {
  const rows = db
    .prepare(
      `SELECT fte.*, ft.user_id, ft.name, ft.parent_tag_id, ft.level, ft.color, ft.allow_multiple, ft.sort_order, ft.created_at as tag_created_at, ft.updated_at as tag_updated_at
       FROM file_tag_entries fte
       JOIN file_tags ft ON fte.tag_id = ft.id
       WHERE fte.entry_id = ?
       ORDER BY fte.is_primary DESC, ft.level ASC, ft.sort_order ASC`
    )
    .all(entryId) as any[];
  
  return rows.map((row) => ({
    id: row.id,
    tag_id: row.tag_id,
    entry_id: row.entry_id,
    is_primary: Boolean(row.is_primary),
    created_at: row.created_at,
    tag: {
      id: row.tag_id,
      user_id: row.user_id,
      name: row.name,
      parent_tag_id: row.parent_tag_id ?? null,
      level: row.level,
      color: row.color ?? null,
      allow_multiple: Boolean(row.allow_multiple),
      sort_order: row.sort_order ?? 0,
      created_at: row.tag_created_at,
      updated_at: row.tag_updated_at,
    },
  }));
};

// 获取标签下的所有文件 ID
export const getEntriesForTag = (tagId: number, includeChildren: boolean = false): string[] => {
  if (!includeChildren) {
    const rows = db
      .prepare("SELECT entry_id FROM file_tag_entries WHERE tag_id = ?")
      .all(tagId) as { entry_id: string }[];
    return rows.map((r) => r.entry_id);
  }
  
  // 递归获取所有子标签 ID
  const getAllDescendantIds = (parentId: number): number[] => {
    const children = db
      .prepare("SELECT id FROM file_tags WHERE parent_tag_id = ?")
      .all(parentId) as { id: number }[];
    
    const ids: number[] = [];
    for (const child of children) {
      ids.push(child.id);
      ids.push(...getAllDescendantIds(child.id));
    }
    return ids;
  };
  
  const allTagIds = [tagId, ...getAllDescendantIds(tagId)];
  const placeholders = allTagIds.map(() => "?").join(",");
  
  const rows = db
    .prepare(`SELECT DISTINCT entry_id FROM file_tag_entries WHERE tag_id IN (${placeholders})`)
    .all(...allTagIds) as { entry_id: string }[];
  
  return rows.map((r) => r.entry_id);
};

// 给文件添加标签
export const addTagToEntry = (entryId: string, tagId: number, isPrimary: boolean = false): FileTagEntry => {
  const tag = getTagById(tagId);
  if (!tag) {
    throw new Error("标签不存在");
  }
  
  // 检查是否已关联
  const existing = db
    .prepare("SELECT id FROM file_tag_entries WHERE tag_id = ? AND entry_id = ?")
    .get(tagId, entryId) as { id: number } | undefined;
  
  if (existing) {
    // 如果已存在，只更新 is_primary
    if (isPrimary) {
      // 先取消其他主标签
      db.prepare("UPDATE file_tag_entries SET is_primary = 0 WHERE entry_id = ? AND is_primary = 1").run(entryId);
      db.prepare("UPDATE file_tag_entries SET is_primary = 1 WHERE id = ?").run(existing.id);
    }
    return db.prepare("SELECT * FROM file_tag_entries WHERE id = ?").get(existing.id) as FileTagEntry;
  }
  
  // 获取一级祖先，检查互斥模式
  const rootAncestor = getRootAncestor(tagId);
  if (rootAncestor && !rootAncestor.allow_multiple) {
    // 互斥模式：移除该一级标签下的其他标签
    const getAllDescendantIds = (parentId: number): number[] => {
      const children = db
        .prepare("SELECT id FROM file_tags WHERE parent_tag_id = ?")
        .all(parentId) as { id: number }[];
      
      const ids: number[] = [];
      for (const child of children) {
        ids.push(child.id);
        ids.push(...getAllDescendantIds(child.id));
      }
      return ids;
    };
    
    const rootFamilyIds = [rootAncestor.id, ...getAllDescendantIds(rootAncestor.id)];
    const placeholders = rootFamilyIds.map(() => "?").join(",");
    
    // 删除该文件在此一级标签家族下的所有关联
    db.prepare(
      `DELETE FROM file_tag_entries WHERE entry_id = ? AND tag_id IN (${placeholders})`
    ).run(entryId, ...rootFamilyIds);
  }
  
  // 如果设置为主标签，先取消其他主标签
  if (isPrimary) {
    db.prepare("UPDATE file_tag_entries SET is_primary = 0 WHERE entry_id = ? AND is_primary = 1").run(entryId);
  }
  
  const now = new Date().toISOString();
  const result = db
    .prepare("INSERT INTO file_tag_entries (tag_id, entry_id, is_primary, created_at) VALUES (?, ?, ?, ?)")
    .run(tagId, entryId, isPrimary ? 1 : 0, now);
  
  return {
    id: Number(result.lastInsertRowid),
    tag_id: tagId,
    entry_id: entryId,
    is_primary: isPrimary,
    created_at: now,
  };
};

// 从文件移除标签
export const removeTagFromEntry = (entryId: string, tagId: number): void => {
  db.prepare("DELETE FROM file_tag_entries WHERE tag_id = ? AND entry_id = ?").run(tagId, entryId);
};

// 设置文件的主标签
export const setPrimaryTag = (entryId: string, tagId: number): void => {
  // 检查关联是否存在
  const existing = db
    .prepare("SELECT id FROM file_tag_entries WHERE tag_id = ? AND entry_id = ?")
    .get(tagId, entryId) as { id: number } | undefined;
  
  if (!existing) {
    throw new Error("该文件未关联此标签");
  }
  
  // 取消其他主标签
  db.prepare("UPDATE file_tag_entries SET is_primary = 0 WHERE entry_id = ? AND is_primary = 1").run(entryId);
  
  // 设置新的主标签
  db.prepare("UPDATE file_tag_entries SET is_primary = 1 WHERE id = ?").run(existing.id);
};

// 清除文件的主标签
export const clearPrimaryTag = (entryId: string): void => {
  db.prepare("UPDATE file_tag_entries SET is_primary = 0 WHERE entry_id = ? AND is_primary = 1").run(entryId);
};

// 批量给文件添加标签
export const addTagToEntries = (entryIds: string[], tagId: number): void => {
  for (const entryId of entryIds) {
    try {
      addTagToEntry(entryId, tagId, false);
    } catch {
      // 忽略单个失败
    }
  }
};

// 批量从文件移除标签
export const removeTagFromEntries = (entryIds: string[], tagId: number): void => {
  const placeholders = entryIds.map(() => "?").join(",");
  db.prepare(
    `DELETE FROM file_tag_entries WHERE tag_id = ? AND entry_id IN (${placeholders})`
  ).run(tagId, ...entryIds);
};

// 获取标签统计信息（每个标签下的文件数量）
export const getTagStats = (): Map<number, number> => {
  const rows = db
    .prepare("SELECT tag_id, COUNT(*) as count FROM file_tag_entries GROUP BY tag_id")
    .all() as { tag_id: number; count: number }[];
  
  const stats = new Map<number, number>();
  for (const row of rows) {
    stats.set(row.tag_id, row.count);
  }
  return stats;
};

// 获取用户所有标签（带统计信息）
export const listAllTagsWithStats = (userId: number): FileTag[] => {
  const tags = listAllTags(userId);
  const stats = getTagStats();
  
  const addStats = (tagList: FileTag[]) => {
    for (const tag of tagList) {
      tag.entry_count = stats.get(tag.id) ?? 0;
      if (tag.children && tag.children.length > 0) {
        addStats(tag.children);
        // 累加子标签的数量
        for (const child of tag.children) {
          tag.entry_count! += child.entry_count ?? 0;
        }
      }
    }
  };
  
  addStats(tags);
  return tags;
};
