import { useNavigate } from "react-router-dom";
import { ChevronRight, ExternalLink, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/common/GlassCard";
import { DS } from "@/theme/design-system";
import { buildApiUrl } from "@/lib/api/client";
import {
  FILE_ICON_COMPONENTS,
  FILE_ICON_DEFAULT_COMPONENT,
  THUMBNAIL_EXTS,
  getFileIconGroup,
} from "@/configs/fileTypeIcons";
import type { ToolCallResult } from "./types";
import { formatSize } from "./format";

export function FileDisplayRenderer({ result }: { result: ToolCallResult }) {
  const navigate = useNavigate();
  const files = result.files || [];
  const title = result.title || "文件";

  const token = typeof window !== "undefined"
    ? window.localStorage.getItem("filecloud_auth_token")
    : null;

  const handleClick = (file: {
    id: string;
    name: string;
    isDirectory: boolean;
    libraryId: number;
  }) => {
    if (file.isDirectory) {
      navigate(`/files?libraryId=${file.libraryId}&parentId=${file.id}`);
    } else {
      navigate(`/preview/${file.id}`);
    }
  };

  const getThumbnailUrl = (file: { id: string; extension: string | null }) => {
    const ext = file.extension?.toLowerCase() || "";
    if (!THUMBNAIL_EXTS.has(ext)) return null;
    return buildApiUrl(
      token
        ? `/file-content/${file.id}/thumbnail?token=${encodeURIComponent(token)}`
        : `/file-content/${file.id}/thumbnail`,
    );
  };

  const getFileIcon = (file: { isDirectory: boolean; extension: string | null }) => {
    if (file.isDirectory) {
      return <Folder className="h-5 w-5 text-amber-500" />;
    }
    const ext = file.extension?.toLowerCase() || "";
    const group = getFileIconGroup(ext);
    const Icon = group ? FILE_ICON_COMPONENTS[group] : FILE_ICON_DEFAULT_COMPONENT;
    return <Icon className="h-5 w-5 text-blue-500" />;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <ExternalLink className="h-3.5 w-3.5" />
        <span>{title}</span>
        <span className="text-muted-foreground/60">(点击跳转)</span>
      </div>
      <div className="space-y-1.5">
        {files.map(
          (file: {
            id: string;
            name: string;
            isDirectory: boolean;
            size: number;
            extension: string | null;
            mimeType: string | null;
            libraryId: number;
          }) => {
            const thumbnailUrl = getThumbnailUrl(file);

            return (
              <GlassCard
                key={file.id}
                variant="lite"
                className={cn("px-3 py-2 cursor-pointer", cn(DS.radius.xl, "button-rect:rounded-lg"))}
                onClick={() => handleClick(file)}
              >
                <div aria-hidden className="absolute inset-0 bg-background/55 dark:bg-black/45 pointer-events-none" />
                <div className="relative z-10 flex items-center gap-3 min-w-0 group">
                  <div className="shrink-0 w-10 h-10 rounded-md overflow-hidden bg-muted/50 flex items-center justify-center">
                    {thumbnailUrl && !file.isDirectory ? (
                      <img
                        src={thumbnailUrl}
                        alt={file.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      getFileIcon(file)
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {file.isDirectory ? "文件夹" : formatSize(file.size)}
                    </div>
                  </div>

                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
                </div>
              </GlassCard>
            );
          },
        )}
      </div>
    </div>
  );
}
