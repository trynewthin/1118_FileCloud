import type { AiChatConversation } from "@/lib/api/aiChat";
import { Dialog, DialogContent } from "@/components/common/dialog/dialog";
import { AiMobileConversationManager } from "@/components/aichat/AiMobileConversationManager";

interface AiConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversations: AiChatConversation[];
  currentId: number | null;
  loading: boolean;
  onSelect: (id: number) => void;
  onNewConversation: () => void;
  onDelete?: (id: number) => Promise<void>;
}

export function AiConversationDialog({
  open,
  onOpenChange,
  conversations,
  currentId,
  loading,
  onSelect,
  onNewConversation,
  onDelete,
}: AiConversationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0! gap-0! sm:max-w-[560px]" showCloseButton={false}>
        <AiMobileConversationManager
          conversations={conversations}
          currentId={currentId}
          loading={loading}
          onSelect={onSelect}
          onNewConversation={onNewConversation}
          onDelete={onDelete}
        />
      </DialogContent>
    </Dialog>
  );
}
