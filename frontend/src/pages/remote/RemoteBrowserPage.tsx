/**
 * 远程文件库浏览页面
 * 显示远程客户端的文件库列表和文件浏览
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { PageContainer } from "@/components/layout/PageContainer";
import { GlassCard } from "@/components/common/GlassCard";
import { GlassButton } from "@/components/common/button/GlassButton";
import { Loader2 } from "lucide-react";
import { FileGridItem, FileListItem } from "@/components/filebrowsepage";
import { getRemoteLibraries, getRemoteEntries, type RemoteClient } from "@/lib/api/remoteProxy";
import { getRemoteClients } from "@/lib/api/remoteProxy";
import type { FileEntry } from "@/lib/api/files";
import { ArrowLeft, RefreshCw, Grid, List, Server, AlertCircle } from "lucide-react";

export function RemoteBrowserPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const libraryIdParam = searchParams.get("libraryId");
  const parentIdParam = searchParams.get("parentId");

  const [client, setClient] = useState<RemoteClient | null>(null);
  const [libraries, setLibraries] = useState<any[]>([]);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // 当前文件库 ID
  const activeLibraryId = libraryIdParam ? parseInt(libraryIdParam) : null;

  // 加载客户端信息
  const loadClient = useCallback(async () => {
    if (!clientId) return;
    try {
      const res = await getRemoteClients();
      const found = res.clients.find((c) => c.id === clientId);
      setClient(found || null);
      if (!found) {
        setError("远程客户端不在线");
      }
    } catch (err: any) {
      setError(err.message || "加载客户端信息失败");
    }
  }, [clientId]);

  // 加载文件库列表
  const loadLibraries = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getRemoteLibraries(clientId);
      setLibraries(res.items || []);
    } catch (err: any) {
      setError(err.message || "加载远程文件库失败");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  // 加载目录内容
  const loadEntries = useCallback(async () => {
    if (!clientId || !activeLibraryId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getRemoteEntries(clientId, activeLibraryId, parentIdParam || undefined);
      setEntries(res.items || []);
    } catch (err: any) {
      setError(err.message || "加载目录内容失败");
    } finally {
      setLoading(false);
    }
  }, [clientId, activeLibraryId, parentIdParam]);

  // 初始加载
  useEffect(() => {
    loadClient();
  }, [loadClient]);

  useEffect(() => {
    if (activeLibraryId) {
      loadEntries();
    } else {
      loadLibraries();
    }
  }, [activeLibraryId, parentIdParam, loadLibraries, loadEntries]);

  // 进入文件库
  const handleEnterLibrary = (libraryId: number) => {
    setSearchParams({ libraryId: String(libraryId) });
  };

  // 进入目录
  const handleEnterDirectory = (entry: FileEntry) => {
    if (entry.is_directory) {
      setSearchParams({
        libraryId: String(activeLibraryId),
        parentId: entry.id,
      });
    }
  };

  // 返回上级
  const handleGoBack = () => {
    if (parentIdParam) {
      // 返回上级目录（简化处理：直接返回文件库根目录）
      setSearchParams({ libraryId: String(activeLibraryId) });
    } else if (activeLibraryId) {
      // 返回文件库列表
      setSearchParams({});
    } else {
      // 返回主页
      navigate("/");
    }
  };

  // 刷新
  const handleRefresh = () => {
    if (activeLibraryId) {
      loadEntries();
    } else {
      loadLibraries();
    }
  };

  const headerLeft = (
    <div className="flex items-center gap-2">
      <GlassButton glassVariant="lite" size="icon" onClick={handleGoBack}>
        <ArrowLeft className="h-4 w-4" />
      </GlassButton>
      <div className="flex items-center gap-2 text-sm">
        <Server className="h-4 w-4 text-primary" />
        <span className="font-medium">{client?.name || "远程客户端"}</span>
        {activeLibraryId && (
          <>
            <span className="text-muted-foreground">/</span>
            <span>{libraries.find((l) => l.id === activeLibraryId)?.display_name || "文件库"}</span>
          </>
        )}
      </div>
    </div>
  );

  const headerRight = (
    <div className="flex items-center gap-2">
      <GlassButton glassVariant="lite" size="icon" onClick={handleRefresh}>
        <RefreshCw className="h-4 w-4" />
      </GlassButton>
      <GlassButton
        glassVariant="lite"
        size="icon"
        onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
      >
        {viewMode === "grid" ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
      </GlassButton>
    </div>
  );

  return (
    <PageContainer leftAction={headerLeft} action={headerRight} showBack={false}>
      <GlassCard className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
            <AlertCircle className="h-12 w-12" />
            <p>{error}</p>
            <GlassButton glassVariant="lite" onClick={handleRefresh}>
              重试
            </GlassButton>
          </div>
        ) : !activeLibraryId ? (
          // 显示文件库列表
          libraries.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              远程客户端暂无文件库
            </div>
          ) : (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3"
                  : "space-y-2"
              }
            >
              {libraries.map((lib) => {
                const virtualEntry: FileEntry = {
                  id: `remote-lib-${lib.id}`,
                  library_id: lib.id,
                  parent_id: null,
                  is_directory: true,
                  original_name: lib.display_name || lib.root_path,
                  index_suffix: null,
                  extension: null,
                  size_bytes: 0,
                  mime_type: null,
                  is_deleted: false,
                  deleted_at: null,
                  created_at: lib.created_at,
                  updated_at: lib.updated_at,
                  _isLibraryEntry: true,
                  _virtualType: "library",
                };
                const Component = viewMode === "grid" ? FileGridItem : FileListItem;
                return (
                  <Component
                    key={lib.id}
                    entry={virtualEntry}
                    onClick={() => handleEnterLibrary(lib.id)}
                    onDoubleClick={() => handleEnterLibrary(lib.id)}
                  />
                );
              })}
            </div>
          )
        ) : (
          // 显示目录内容
          entries.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              空目录
            </div>
          ) : (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3"
                  : "space-y-2"
              }
            >
              {entries.map((entry) => {
                const Component = viewMode === "grid" ? FileGridItem : FileListItem;
                return (
                  <Component
                    key={entry.id}
                    entry={entry}
                    onClick={() => entry.is_directory && handleEnterDirectory(entry)}
                    onDoubleClick={() => entry.is_directory && handleEnterDirectory(entry)}
                  />
                );
              })}
            </div>
          )
        )}
      </GlassCard>
    </PageContainer>
  );
}
