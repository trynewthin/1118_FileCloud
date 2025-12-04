# 融合访问架构设计

## 1. 设计目标

### 1.1 核心理念

**"淡化库的存在，统一文件视图"**

用户在日常使用中不需要关心文件属于哪个库，系统提供统一的文件浏览体验。但当某个库离线（如 U 盘断开）时，相关文件应清晰展示离线状态。

### 1.2 关键特性

1. **统一入口**：提供跨库的文件列表、搜索、最近访问
2. **实时感知**：文件库在线状态实时监控，前端及时获知
3. **优雅降级**：离线库的文件仍可浏览元数据，但操作受限
4. **透明切换**：库恢复在线后自动恢复正常状态

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                            Frontend                                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    统一文件浏览器                              │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐              │   │
│  │  │ 全部文件   │  │  最近访问  │  │   搜索     │              │   │
│  │  └────────────┘  └────────────┘  └────────────┘              │   │
│  │                                                               │   │
│  │  ┌─────────────────────────────────────────────────────────┐ │   │
│  │  │              文件列表（带离线状态标识）                   │ │   │
│  │  │  📁 文档 (本地)           ✓ 在线                        │ │   │
│  │  │  📁 照片 (U盘)            ⚠ 离线                        │ │   │
│  │  │  📄 报告.pdf (本地)       ✓ 在线                        │ │   │
│  │  └─────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                │                                     │
│                                ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   状态订阅 (轮询/WebSocket)                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            Backend                                   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                  LibraryWatcher Service                       │   │
│  │  - 定时检测文件库根路径是否可访问                              │   │
│  │  - 维护内存中的在线状态缓存                                    │   │
│  │  - 状态变化时更新数据库                                        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                │                                     │
│                                ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                     Unified API Layer                         │   │
│  │                                                               │   │
│  │  GET /api/entries                    # 跨库文件列表           │   │
│  │  GET /api/entries/recent             # 最近访问               │   │
│  │  GET /api/entries/search             # 跨库搜索               │   │
│  │  GET /api/libraries/status           # 所有库状态             │   │
│  │                                                               │   │
│  │  # 现有 API 保持兼容                                          │   │
│  │  GET /api/files/library/:id/entries  # 单库文件列表           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                │                                     │
│                                ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                     Data Layer                                │   │
│  │                                                               │   │
│  │  file_libraries                                               │   │
│  │  ├── is_online_cached (实时状态)                              │   │
│  │  └── last_online_check_at (最后检测时间)                      │   │
│  │                                                               │   │
│  │  file_entries                                                 │   │
│  │  └── (通过 library_id 关联库状态)                             │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 在线状态监控

#### 2.2.1 LibraryWatcher 服务

```typescript
// core/services/libraryWatcher.ts
class LibraryWatcher {
  private checkInterval: number = 3000;  // 3秒检测一次
  private statusCache: Map<number, boolean> = new Map();
  
  start(): void;
  stop(): void;
  
  // 检测单个库是否在线
  checkLibraryOnline(libraryId: number): boolean;
  
  // 获取所有库的在线状态
  getAllStatus(): Map<number, boolean>;
  
  // 状态变化回调
  onStatusChange(callback: (libraryId: number, isOnline: boolean) => void): void;
}
```

#### 2.2.2 检测策略

```typescript
const checkLibraryOnline = (rootPath: string): boolean => {
  try {
    // 1. 检查路径是否存在
    if (!fs.existsSync(rootPath)) return false;
    
    // 2. 检查是否可读
    fs.accessSync(rootPath, fs.constants.R_OK);
    
    // 3. 尝试读取目录（验证实际可访问）
    fs.readdirSync(rootPath, { withFileTypes: true });
    
    return true;
  } catch {
    return false;
  }
};
```

### 2.3 API 设计

#### 2.3.1 统一文件列表 API

```typescript
// GET /api/entries
// 跨库文件列表，支持分页和过滤
interface UnifiedEntriesRequest {
  parentId?: string;        // 父目录 ID（可选，不传则返回所有库的根目录）
  libraryIds?: number[];    // 限定库（可选，不传则查询所有启用的库）
  includeOffline?: boolean; // 是否包含离线库的文件，默认 true
  page?: number;
  pageSize?: number;
}

interface UnifiedEntriesResponse {
  items: UnifiedFileEntry[];
  libraries: LibraryStatus[];  // 涉及的库状态
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

interface UnifiedFileEntry {
  id: string;
  library_id: number;
  library_name: string;      // 库显示名
  library_online: boolean;   // 库是否在线
  parent_id: string | null;
  is_directory: boolean;
  original_name: string;
  extension: string | null;
  size_bytes: number;
  created_at: string;
  updated_at: string;
}

interface LibraryStatus {
  id: number;
  display_name: string;
  is_online: boolean;
  last_check_at: string;
}
```

#### 2.3.2 库状态 API

```typescript
// GET /api/libraries/status
// 获取所有库的实时状态
interface LibrariesStatusResponse {
  libraries: LibraryStatus[];
  check_interval_ms: number;  // 告知前端检测间隔
}
```

#### 2.3.3 文件操作的离线处理

```typescript
// 离线库的文件操作返回特定错误码
interface OfflineError {
  code: "LIBRARY_OFFLINE";
  message: "文件库离线，无法执行此操作";
  library_id: number;
  library_name: string;
}
```

### 2.4 前端状态管理

#### 2.4.1 库状态 Store

```typescript
// stores/libraryStatusStore.ts
interface LibraryStatusStore {
  // 状态
  statuses: Map<number, LibraryStatus>;
  lastFetchAt: Date | null;
  
  // 方法
  fetchStatus(): Promise<void>;
  isOnline(libraryId: number): boolean;
  
  // 自动轮询
  startPolling(intervalMs?: number): void;
  stopPolling(): void;
}
```

#### 2.4.2 文件列表增强

```typescript
// 文件项组件增强
interface FileItemProps {
  entry: UnifiedFileEntry;
  // 离线状态下的 UI 处理
  onOfflineAction?: () => void;
}

// 离线样式
const offlineStyles = {
  opacity: 0.5,
  cursor: "not-allowed",
  // 显示离线图标
};
```

---

## 3. 数据库变更

### 3.1 file_libraries 表增强

```sql
-- 添加最后检测时间字段
ALTER TABLE file_libraries ADD COLUMN last_online_check_at TEXT;
```

### 3.2 查询优化

```sql
-- 跨库查询索引
CREATE INDEX IF NOT EXISTS idx_file_entries_parent_name 
ON file_entries(parent_id, original_name) WHERE is_deleted = 0;

-- 库状态查询索引
CREATE INDEX IF NOT EXISTS idx_file_libraries_enabled_online 
ON file_libraries(is_enabled, is_online_cached);
```

---

## 4. 实施计划

### Phase 1: 基础设施（当前）
1. ✅ 统一中间件层
2. 创建 LibraryWatcher 服务
3. 添加库状态 API

### Phase 2: API 扩展
1. 实现统一文件列表 API
2. 文件条目返回库状态
3. 离线操作错误处理

### Phase 3: 前端适配
1. 库状态轮询机制
2. 文件列表离线样式
3. 操作受限提示

### Phase 4: 高级功能
1. 最近访问记录
2. 跨库搜索
3. 收藏夹功能

---

## 5. 兼容性

### 5.1 API 兼容

- 现有 `/api/files/library/:id/entries` 保持不变
- 新增 `/api/entries` 作为统一入口
- 响应格式向后兼容，新增字段不影响旧客户端

### 5.2 渐进式迁移

1. 前端可选择使用新 API 或旧 API
2. 旧 API 内部调用新服务层
3. 最终统一到新架构

---

## 6. 性能考虑

### 6.1 状态检测

- 检测间隔：3 秒（可配置）
- 使用内存缓存，避免频繁 IO
- 仅在状态变化时更新数据库

### 6.2 跨库查询

- 使用 UNION ALL 合并多库查询
- 支持分页，避免一次返回过多数据
- 离线库的文件从缓存返回元数据

### 6.3 前端优化

- 库状态轮询间隔：5 秒
- 使用 React Query 或 SWR 缓存
- 离线状态变化时局部更新
