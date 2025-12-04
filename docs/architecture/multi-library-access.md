# 多文件库访问架构设计

## 1. 现状分析

### 1.1 当前架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ FileBrowserPage │  │ FilePreviewPage │  │   Dialogs       │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │           │
│           └────────────────────┼────────────────────┘           │
│                                ▼                                │
│                    ┌─────────────────────┐                      │
│                    │   lib/api/files.ts  │                      │
│                    └──────────┬──────────┘                      │
└───────────────────────────────┼─────────────────────────────────┘
                                │ HTTP
                                ▼
┌───────────────────────────────────────────────────────────────────┐
│                          Backend                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                      Router Layer                            │  │
│  │  /api/files/library/:libraryId/entries                       │  │
│  │  /api/files/library/:libraryId/upload                        │  │
│  │  /api/files/entries/:id/rename                               │  │
│  │  /api/file-content/entries/:id/stream                        │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                │                                   │
│                                ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                     Service Layer                            │  │
│  │  files/service.ts    fileOps.ts    ftsService.ts             │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                │                                   │
│                                ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                      Data Layer                              │  │
│  │                    SQLite (better-sqlite3)                   │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

### 1.2 当前问题

1. **路由设计不一致**
   - 部分接口需要 `libraryId`：`/library/:libraryId/entries`
   - 部分接口直接用 `entryId`：`/entries/:id/rename`
   - 缺乏统一的访问模式

2. **文件库校验分散**
   - `ensureLibraryEnabled()` 在 router 层重复调用
   - 每个接口独立校验，缺乏统一中间件

3. **跨库操作限制**
   - 移动/复制限制在同一文件库内
   - 缺乏跨库操作的设计预留

4. **服务层耦合**
   - `getLibraryRoot()` 在多个文件中重复定义
   - 路径构建逻辑分散

---

## 2. 架构设计目标

### 2.1 设计原则

1. **单一职责原则 (SRP)**
   - 路由层：参数校验、权限控制、响应格式化
   - 服务层：业务逻辑
   - 数据层：数据访问

2. **开闭原则 (OCP)**
   - 对扩展开放：易于添加新的文件库类型
   - 对修改关闭：核心逻辑稳定

3. **依赖倒置原则 (DIP)**
   - 高层模块不依赖低层模块
   - 通过接口/类型定义解耦

4. **关注点分离**
   - 文件库管理与文件操作分离
   - 权限控制与业务逻辑分离

### 2.2 目标架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                            Frontend                                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    React Components                           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                │                                     │
│                                ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                     API Client Layer                          │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐              │   │
│  │  │ libraries  │  │   files    │  │  content   │              │   │
│  │  └────────────┘  └────────────┘  └────────────┘              │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            Backend                                   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Middleware Layer                           │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐              │   │
│  │  │   auth     │  │  library   │  │   entry    │              │   │
│  │  │ middleware │  │ middleware │  │ middleware │              │   │
│  │  └────────────┘  └────────────┘  └────────────┘              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                │                                     │
│                                ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      Router Layer                             │   │
│  │  /api/libraries/:libraryId/...                                │   │
│  │  /api/entries/:entryId/...                                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                │                                     │
│                                ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                     Service Layer                             │   │
│  │  ┌─────────────────┐  ┌─────────────────┐                    │   │
│  │  │ LibraryService  │  │  EntryService   │                    │   │
│  │  │ - getById()     │  │ - getById()     │                    │   │
│  │  │ - list()        │  │ - list()        │                    │   │
│  │  │ - create()      │  │ - create()      │                    │   │
│  │  │ - update()      │  │ - move()        │                    │   │
│  │  │ - delete()      │  │ - copy()        │                    │   │
│  │  └─────────────────┘  └─────────────────┘                    │   │
│  │                                                               │   │
│  │  ┌─────────────────┐  ┌─────────────────┐                    │   │
│  │  │ ContentService  │  │  SearchService  │                    │   │
│  │  │ - stream()      │  │ - search()      │                    │   │
│  │  │ - thumbnail()   │  │ - index()       │                    │   │
│  │  └─────────────────┘  └─────────────────┘                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                │                                     │
│                                ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   Repository Layer                            │   │
│  │  ┌─────────────────┐  ┌─────────────────┐                    │   │
│  │  │LibraryRepository│  │ EntryRepository │                    │   │
│  │  └─────────────────┘  └─────────────────┘                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                │                                     │
│                                ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      Data Layer                               │   │
│  │                   SQLite + File System                        │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. 详细设计

### 3.1 统一中间件

#### 3.1.1 文件库中间件 (`libraryMiddleware`)

```typescript
// core/middleware/library.ts
export interface LibraryContext {
  library: {
    id: number;
    rootPath: string;
    displayName: string;
    isEnabled: boolean;
  };
}

export const withLibrary = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const libraryId = Number(req.params.libraryId);
    
    if (!Number.isInteger(libraryId) || libraryId <= 0) {
      return res.status(400).json({ message: "文件库 ID 不合法" });
    }
    
    const library = libraryRepository.getById(libraryId);
    if (!library) {
      return res.status(404).json({ message: "文件库不存在" });
    }
    
    if (!library.isEnabled) {
      return res.status(403).json({ message: "文件库未启用" });
    }
    
    req.library = library;
    next();
  };
};
```

#### 3.1.2 条目中间件 (`entryMiddleware`)

```typescript
// core/middleware/entry.ts
export interface EntryContext {
  entry: FileEntry;
  library: LibraryContext['library'];
}

export const withEntry = (options?: { includeDeleted?: boolean }) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const entryId = req.params.entryId || req.params.id;
    
    if (!entryId || typeof entryId !== "string") {
      return res.status(400).json({ message: "条目 ID 不合法" });
    }
    
    const entry = options?.includeDeleted 
      ? entryRepository.getByIdIncludingDeleted(entryId)
      : entryRepository.getById(entryId);
      
    if (!entry) {
      return res.status(404).json({ message: "文件或目录不存在" });
    }
    
    // 自动加载关联的文件库
    const library = libraryRepository.getById(entry.library_id);
    if (!library || !library.isEnabled) {
      return res.status(403).json({ message: "文件库不可用" });
    }
    
    req.entry = entry;
    req.library = library;
    next();
  };
};
```

### 3.2 路由重构

#### 3.2.1 新路由结构

```
/api/libraries
  GET    /                           # 列出所有文件库
  POST   /                           # 创建文件库
  GET    /:libraryId                 # 获取单个文件库
  PATCH  /:libraryId                 # 更新文件库
  DELETE /:libraryId                 # 删除文件库
  POST   /:libraryId/refresh         # 刷新状态
  POST   /:libraryId/index           # 触发索引

/api/libraries/:libraryId/entries
  GET    /                           # 列出条目
  POST   /                           # 上传文件
  POST   /mkdir                      # 新建文件夹

/api/libraries/:libraryId/search
  GET    /                           # 搜索
  GET    /folders                    # 搜索文件夹
  GET    /stats                      # 索引统计

/api/libraries/:libraryId/trash
  GET    /                           # 列出回收站

/api/entries/:entryId
  GET    /                           # 获取条目详情
  POST   /rename                     # 重命名
  POST   /move                       # 移动
  POST   /copy                       # 复制
  POST   /delete                     # 删除（移入回收站）
  POST   /restore                    # 还原
  POST   /destroy                    # 彻底删除

/api/entries/:entryId/content
  GET    /stream                     # 流式读取
  GET    /download                   # 下载
  GET    /thumbnail                  # 缩略图

/api/entries/:entryId/security
  GET    /                           # 获取安全设置
  POST   /password                   # 设置密码
  DELETE /password                   # 清除密码

/api/entries/:entryId/tags
  GET    /                           # 获取标签
  POST   /                           # 添加标签
  DELETE /:tagId                     # 移除标签
```

### 3.3 服务层重构

#### 3.3.1 LibraryService

```typescript
// modules/libraries/service.ts
export class LibraryService {
  constructor(private repo: LibraryRepository) {}
  
  getById(id: number): FileLibrary | null;
  list(): FileLibrary[];
  create(input: CreateLibraryInput): FileLibrary;
  update(id: number, input: UpdateLibraryInput): FileLibrary | null;
  delete(id: number): boolean;
  refresh(id: number): FileLibrary | null;
  
  // 辅助方法
  getRootPath(id: number): string;
  ensureEnabled(id: number): FileLibrary;
}
```

#### 3.3.2 EntryService

```typescript
// modules/entries/service.ts
export class EntryService {
  constructor(
    private repo: EntryRepository,
    private libraryService: LibraryService,
  ) {}
  
  getById(id: string): FileEntry | null;
  list(libraryId: number, parentId: string | null): FileEntry[];
  
  // 文件操作
  rename(id: string, newName: string): void;
  move(id: string, targetParentId: string | null): void;
  copy(id: string, targetParentId: string | null, newName?: string): string;
  delete(id: string): void;
  restore(id: string): void;
  destroy(id: string): void;
  
  // 路径解析
  getAbsolutePath(entry: FileEntry): string;
  getRelativePath(entry: FileEntry): string;
  getAncestors(entry: FileEntry): Ancestor[];
}
```

### 3.4 类型定义增强

```typescript
// types/express.d.ts
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        role: string;
      };
      library?: {
        id: number;
        rootPath: string;
        displayName: string;
        isEnabled: boolean;
      };
      entry?: FileEntry;
    }
  }
}
```

---

## 4. 实施计划

### Phase 1: 基础重构（当前）
1. ✅ 移除破坏性索引逻辑
2. 创建统一中间件
3. 重构路由层

### Phase 2: 服务层优化
1. 抽取公共逻辑到 LibraryService
2. 统一路径解析逻辑
3. 添加类型定义

### Phase 3: 前端适配
1. 更新 API 客户端
2. 统一错误处理
3. 优化状态管理

### Phase 4: 扩展功能
1. 跨库移动/复制
2. 文件库权限控制
3. 多用户隔离

---

## 5. 兼容性考虑

### 5.1 API 版本控制

保持旧路由兼容，新路由使用 `/api/v2/` 前缀：

```typescript
// 旧路由（保持兼容）
app.use("/api/files", filesRouter);
app.use("/api/file-libraries", fileLibrariesRouter);

// 新路由
app.use("/api/v2/libraries", librariesRouterV2);
app.use("/api/v2/entries", entriesRouterV2);
```

### 5.2 渐进式迁移

1. 新功能使用新路由
2. 旧功能逐步迁移
3. 设置废弃警告
4. 最终移除旧路由

---

## 6. 测试策略

### 6.1 单元测试
- 服务层方法测试
- 中间件测试
- 工具函数测试

### 6.2 集成测试
- API 端点测试
- 权限控制测试
- 跨库操作测试

### 6.3 E2E 测试
- 文件上传下载流程
- 文件操作流程
- 搜索功能测试
