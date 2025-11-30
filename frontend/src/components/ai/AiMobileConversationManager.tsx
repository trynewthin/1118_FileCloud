import { useState } from "react";
import type { AiChatConversation } from "@/lib/api/aiChat";
import { GlassButton } from "@/components/common/GlassButton";
import { GlassCard } from "@/components/common/GlassCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, MessageSquare, Archive, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DS } from "@/lib/design-system";

interface AiMobileConversationManagerProps {
  conversations: AiChatConversation[];
  currentId: number | null;
  loading: boolean;
  onSelect: (id: number) => void;
  onNewConversation: () => void;
  onDelete?: (id: number) => Promise<void>;
}

export function AiMobileConversationManager({
  conversations,
  currentId,
  loading,
  onSelect,
  onNewConversation,
  onDelete,
}: AiMobileConversationManagerProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // 点击删除按钮，打开确认弹窗
  const handleDeleteClick = (e: React.MouseEvent, id: number) => {
    e.stopPropagation(); // 阻止触发 onSelect
    setConfirmDeleteId(id);
  };

  // 确认删除
  const handleConfirmDelete = async () => {
    if (!onDelete || !confirmDeleteId || deletingId) return;
    
    setDeletingId(confirmDeleteId);
    try {
      await onDelete(confirmDeleteId);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  // 取消删除
  const handleCancelDelete = () => {
    setConfirmDeleteId(null);
  };

  // 获取要删除的会话标题
  const deleteTargetConversation = confirmDeleteId 
    ? conversations.find(c => c.id === confirmDeleteId) 
    : null;
  const hasConversations = conversations.length > 0;

  return (
    <GlassCard variant="strong" className="flex flex-col gap-3 p-3 w-full max-w-sm mx-auto shadow-xl border-white/20">
      <div className="flex items-center justify-between px-1">
        <span className={cn("text-xs font-medium text-muted-foreground", DS.text.subheading)}>会话列表</span>
        <GlassButton 
          size="sm" 
          glassVariant="lite"
          className="h-7 text-xs px-2"
          onClick={onNewConversation} 
          disabled={loading}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          新会话
        </GlassButton>
      </div>

      {loading && !hasConversations && (
        <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">正在加载会话...</div>
      )}
      {!loading && !hasConversations && (
        <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
          <div className="p-2 rounded-full bg-muted/20">
            <MessageSquare className="h-4 w-4 opacity-50" />
          </div>
          暂无历史会话
        </div>
      )}
      {hasConversations && (
        <ScrollArea className="h-[300px] pr-3 -mr-2">
          <div className="flex flex-col gap-2 pb-2">
            {conversations.map((c) => {
              const active = c.id === currentId;
              return (
                <div
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl p-2 cursor-pointer transition-all duration-200",
                    active 
                      ? "bg-primary/10 shadow-sm border border-primary/10" 
                      : "hover:bg-white/5 border border-transparent hover:border-white/10"
                  )}
                >
                  {/* Icon Container */}
                  <div className={cn(
                    "shrink-0 h-9 w-9 rounded-lg flex items-center justify-center transition-colors",
                    c.is_archived 
                      ? "bg-orange-500/10 text-orange-500" 
                      : active ? "bg-primary text-primary-foreground shadow-sm" : "bg-primary/10 text-primary group-hover:bg-primary/20"
                  )}>
                    {c.is_archived ? <Archive className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                  </div>

                  {/* Text Info */}
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div className={cn(
                      "truncate text-sm font-medium transition-colors",
                      active ? "text-foreground" : "text-foreground/80"
                    )}>
                      {c.title || `会话 #${c.id}`}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{new Date(c.created_at).toLocaleDateString()}</span>
                      {c.model_id && <span className="bg-muted/30 px-1 rounded">{c.model_id}</span>}
                    </div>
                  </div>

                  {/* Delete Button - 始终可见 */}
                  {onDelete && (
                    <button
                      type="button"
                      className={cn(
                        "shrink-0 h-7 w-7 rounded-lg flex items-center justify-center transition-colors",
                        "text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10",
                        deletingId === c.id && "text-destructive animate-pulse"
                      )}
                      onClick={(e) => handleDeleteClick(e, c.id)}
                      disabled={deletingId !== null}
                      title="删除会话"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {/* Active Indicator */}
                  {active && !onDelete && (
                    <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* 删除确认弹窗 */}
      <AlertDialog open={confirmDeleteId !== null} onOpenChange={(open) => !open && handleCancelDelete()}>
        <AlertDialogContent className={cn(DS.glass.strong, "border-white/10")}>
          <AlertDialogHeader>
            <AlertDialogTitle>删除会话</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除会话 "{deleteTargetConversation?.title || `会话 #${confirmDeleteId}`}" 吗？
              <br />
              此操作不可撤销，所有聊天记录将被永久删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={handleCancelDelete}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">取消</span>
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deletingId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">删除</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </GlassCard>
  );
}
