import { Tag, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/common/GlassCard";
import type { FileTag } from "@/lib/api/tags";

interface TagGridItemProps {
  tag: FileTag;
  onClick?: () => void;
}

export function TagGridItem({ tag, onClick }: TagGridItemProps) {
  const hasChildren = tag.children && tag.children.length > 0;
  const tagColor = tag.color || "#6b7280";

  return (
    <GlassCard
      variant="ghost"
      hoverEffect
      className={cn(
        "group relative flex flex-col items-center justify-between p-2 text-center cursor-pointer transition-all duration-300"
      )}
      onClick={onClick}
    >
      <div className="flex flex-1 flex-col items-center gap-2 w-full">
        {/* 统一的图标框架：固定比例 + 边框，和 FileGridItem 保持一致 */}
        <div
          className="w-full max-h-24 aspect-4/3 rounded-xl border border-white/10 overflow-hidden flex items-center justify-center shadow-sm"
          style={{ backgroundColor: `${tagColor}15` }}
        >
          {hasChildren ? (
            <Folder className="h-8 w-8" style={{ color: tagColor }} />
          ) : (
            <Tag className="h-8 w-8" style={{ color: tagColor }} />
          )}
        </div>

        <div className="w-full mt-1 space-y-1 text-left">
          {/* 标签名称 */}
          <p className="truncate text-sm font-medium leading-none" title={tag.name}>
            {tag.name}
          </p>
          {/* 统计信息 */}
          <p className="text-xs text-muted-foreground">
            {hasChildren && `${tag.children!.length} 个子标签`}
            {hasChildren && tag.entry_count ? " · " : ""}
            {tag.entry_count ? `${tag.entry_count} 个文件` : (!hasChildren ? "标签" : "")}
          </p>
        </div>
      </div>
    </GlassCard>
  );
}
