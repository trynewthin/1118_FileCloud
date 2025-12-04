# 文件传输优化方案

## 一、现状分析

### 1.1 当前实现

#### 下载/预览（流式输出）
- **位置**：`fileContent/service.ts` + `fileContent/router.ts`
- **机制**：使用 Node.js `fs.createReadStream` + `pipe` 到 Response
- **Range 支持**：已实现 HTTP Range 请求，支持视频/音频拖拽播放
- **问题**：
  1. 客户端断开时流未主动关闭，可能造成资源泄漏
  2. 无缓存控制头，浏览器无法利用缓存
  3. 无传输压缩（对文本类文件）
  4. 无连接超时控制

#### 上传
- **位置**：`files/router.ts` 的 `/library/:libraryId/upload`
- **机制**：使用 Busboy 解析 multipart/form-data，流式写入磁盘
- **问题**：
  1. 无上传进度反馈
  2. 无断点续传支持
  3. 无文件大小限制校验
  4. 无上传速率限制

---

## 二、优化目标

1. **最大化传输效率**：确保瓶颈仅在网络带宽
2. **资源及时释放**：客户端断开时立即中断流、释放文件句柄
3. **缓存优化**：利用 ETag/Last-Modified 减少重复传输
4. **断点续传**：大文件上传支持断点续传
5. **进度反馈**：上传/下载进度可追踪

---

## 三、详细优化方案

### 3.1 下载/预览优化

#### 3.1.1 连接中断检测与流关闭

```typescript
// 核心：监听 req.on('close') 事件，主动销毁读取流
export const streamFileWithRange = (
  req: Request,
  res: Response,
  opts: { realPath: string; contentType: string; size: number },
) => {
  const { realPath, contentType, size } = opts;
  const range = req.headers.range;

  // 创建读取流
  const streamOpts = range ? parseRange(range, size) : { start: 0, end: size - 1 };
  if (!streamOpts) {
    return res.status(416).end();
  }

  const { start, end } = streamOpts;
  const chunkSize = end - start + 1;
  const stream = fs.createReadStream(realPath, { start, end, highWaterMark: 64 * 1024 });

  // 关键：客户端断开时销毁流
  const cleanup = () => {
    if (!stream.destroyed) {
      stream.destroy();
    }
  };

  req.on('close', cleanup);      // 客户端主动断开（如关闭视频播放器）
  req.on('aborted', cleanup);    // 请求被中止
  res.on('close', cleanup);      // 响应关闭

  // 流错误处理
  stream.on('error', (err) => {
    console.error('[stream] 读取文件失败', err);
    cleanup();
    if (!res.headersSent) {
      res.status(500).json({ message: '读取文件失败' });
    }
  });

  // 设置响应头
  const headers: Record<string, string | number> = {
    'Content-Type': contentType,
    'Content-Length': chunkSize,
    'Accept-Ranges': 'bytes',
  };

  if (range) {
    headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
    res.writeHead(206, headers);
  } else {
    res.writeHead(200, headers);
  }

  stream.pipe(res);
};
```

#### 3.1.2 缓存控制

```typescript
// 添加 ETag 和 Last-Modified 支持
const stat = fs.statSync(realPath);
const etag = `"${stat.size}-${stat.mtimeMs}"`;
const lastModified = stat.mtime.toUTCString();

// 检查条件请求
if (req.headers['if-none-match'] === etag || 
    req.headers['if-modified-since'] === lastModified) {
  return res.status(304).end();
}

res.setHeader('ETag', etag);
res.setHeader('Last-Modified', lastModified);
res.setHeader('Cache-Control', 'private, max-age=3600'); // 1小时缓存
```

#### 3.1.3 高性能读取配置

```typescript
// 优化 highWaterMark（读取缓冲区大小）
// 默认 64KB，对于视频流可以适当增大
const highWaterMark = isVideoOrAudio(contentType) ? 256 * 1024 : 64 * 1024;

const stream = fs.createReadStream(realPath, { 
  start, 
  end, 
  highWaterMark 
});
```

#### 3.1.4 压缩支持（文本类文件）

```typescript
import zlib from 'node:zlib';

// 对文本类文件启用 gzip 压缩
const isCompressible = (contentType: string) => {
  return /^(text\/|application\/json|application\/javascript)/.test(contentType);
};

if (isCompressible(contentType) && req.headers['accept-encoding']?.includes('gzip')) {
  res.setHeader('Content-Encoding', 'gzip');
  stream.pipe(zlib.createGzip()).pipe(res);
} else {
  stream.pipe(res);
}
```

---

### 3.2 上传优化

#### 3.2.1 文件大小限制

```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10GB

const bb = Busboy({ 
  headers: req.headers,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 100, // 单次最多上传 100 个文件
  }
});

bb.on('file', (fieldname, file, info) => {
  file.on('limit', () => {
    // 文件超过大小限制
    file.resume(); // 丢弃剩余数据
    errorOccurred = true;
    errorMessage = `文件 ${info.filename} 超过大小限制`;
  });
});
```

#### 3.2.2 上传进度追踪

```typescript
// 方案 A：通过 SSE 推送进度
// 方案 B：轮询任务状态（已有任务系统）
// 方案 C：WebSocket 实时推送

// 推荐方案 B：复用现有任务系统
// 上传时创建一个 UPLOAD 类型任务，前端轮询任务进度

interface UploadProgress {
  totalBytes: number;
  uploadedBytes: number;
  currentFile: string;
  filesCompleted: number;
  filesTotal: number;
}

// 在 file.on('data') 中更新进度
file.on('data', (chunk) => {
  uploadedBytes += chunk.length;
  // 更新任务进度（节流，每 500ms 更新一次）
  throttledUpdateProgress(taskId, {
    progress: Math.floor((uploadedBytes / totalBytes) * 100),
    detail: JSON.stringify({ uploadedBytes, totalBytes, currentFile })
  });
});
```

#### 3.2.3 断点续传（分片上传）

```typescript
// 前端分片上传接口
// POST /api/files/library/:libraryId/upload/init
// 返回 uploadId

// POST /api/files/library/:libraryId/upload/chunk
// 上传单个分片，参数：uploadId, chunkIndex, chunk

// POST /api/files/library/:libraryId/upload/complete
// 合并分片，参数：uploadId

interface ChunkUploadInit {
  filename: string;
  totalSize: number;
  chunkSize: number;  // 默认 5MB
  totalChunks: number;
  parentId?: string;
}

interface ChunkUploadState {
  uploadId: string;
  filename: string;
  totalSize: number;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: Set<number>;
  tempDir: string;
  createdAt: Date;
  expiresAt: Date;  // 24小时后过期
}

// 存储在内存或 Redis 中
const uploadSessions = new Map<string, ChunkUploadState>();
```

---

### 3.3 统一流式传输服务

创建统一的流式传输服务，封装所有优化逻辑：

```typescript
// core/services/streamService.ts

export interface StreamOptions {
  realPath: string;
  contentType: string;
  size: number;
  filename?: string;          // 用于 Content-Disposition
  disposition?: 'inline' | 'attachment';  // 预览 vs 下载
  enableCache?: boolean;      // 是否启用缓存
  enableCompression?: boolean; // 是否启用压缩
}

export const streamFile = (
  req: Request,
  res: Response,
  options: StreamOptions
): void => {
  const {
    realPath,
    contentType,
    size,
    filename,
    disposition = 'inline',
    enableCache = true,
    enableCompression = true,
  } = options;

  // 1. 缓存检查
  if (enableCache) {
    const stat = fs.statSync(realPath);
    const etag = `"${stat.size}-${stat.mtimeMs}"`;
    
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
    
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, max-age=3600');
  }

  // 2. Range 解析
  const range = req.headers.range;
  let start = 0;
  let end = size - 1;
  let statusCode = 200;

  if (range) {
    const parsed = parseRangeHeader(range, size);
    if (!parsed) {
      return res.status(416).end();
    }
    start = parsed.start;
    end = parsed.end;
    statusCode = 206;
  }

  const chunkSize = end - start + 1;

  // 3. 创建读取流
  const highWaterMark = isMediaType(contentType) ? 256 * 1024 : 64 * 1024;
  const stream = fs.createReadStream(realPath, { start, end, highWaterMark });

  // 4. 连接中断处理
  const cleanup = () => {
    if (!stream.destroyed) stream.destroy();
  };
  req.on('close', cleanup);
  res.on('close', cleanup);

  // 5. 错误处理
  stream.on('error', (err) => {
    console.error('[streamFile] Error:', err);
    cleanup();
    if (!res.headersSent) {
      res.status(500).json({ message: '读取文件失败' });
    }
  });

  // 6. 设置响应头
  const headers: Record<string, string | number> = {
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
  };

  if (filename) {
    const encodedFilename = encodeURIComponent(filename);
    headers['Content-Disposition'] = 
      `${disposition}; filename*=UTF-8''${encodedFilename}`;
  }

  if (range) {
    headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  }

  // 7. 压缩处理
  const shouldCompress = enableCompression && 
    isCompressible(contentType) && 
    !range &&  // Range 请求不压缩
    req.headers['accept-encoding']?.includes('gzip');

  if (shouldCompress) {
    headers['Content-Encoding'] = 'gzip';
    // 压缩后大小未知，移除 Content-Length
    res.writeHead(statusCode, headers);
    stream.pipe(zlib.createGzip()).pipe(res);
  } else {
    headers['Content-Length'] = chunkSize;
    res.writeHead(statusCode, headers);
    stream.pipe(res);
  }
};
```

---

## 四、实施计划

### 阶段 1：核心优化（优先级高）
1. 实现连接中断检测与流关闭
2. 添加缓存控制头（ETag/Last-Modified）
3. 优化 highWaterMark 配置

### 阶段 2：上传增强
1. 添加文件大小限制
2. 实现上传进度追踪（复用任务系统）

### 阶段 3：高级功能（可选）
1. 分片上传/断点续传
2. 文本文件压缩
3. 上传速率限制

---

## 五、关键问题解答

### Q: 退出播放时如何中断流式传输？

**A**: 当用户关闭视频播放器或切换页面时：
1. 浏览器会主动关闭 HTTP 连接
2. Node.js 的 `req` 对象会触发 `close` 事件
3. 我们在 `close` 事件中调用 `stream.destroy()` 销毁读取流
4. 文件句柄被释放，停止从磁盘读取数据

这是标准的资源清理模式，确保：
- 不会继续读取用户不再需要的数据
- 释放文件句柄，避免资源泄漏
- 节省服务器 I/O 和内存

### Q: 如何确保最大阻力是网速？

**A**: 通过以下措施：
1. **增大 highWaterMark**：减少系统调用次数
2. **使用 pipe**：Node.js 自动处理背压（backpressure）
3. **避免不必要的数据拷贝**：直接 pipe 到 response
4. **缓存控制**：减少重复传输
5. **Range 支持**：只传输需要的部分

---

## 六、性能预期

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 连接断开资源释放 | 可能泄漏 | 立即释放 |
| 重复请求传输量 | 100% | 0%（304） |
| 视频拖拽响应 | 正常 | 更快（更大缓冲区） |
| 大文件上传 | 无进度 | 有进度 |
