import { useEffect, useRef, useState } from "react";
import type React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Send, Square, ImagePlus, X } from "lucide-react";
import { GlassButton } from "@/components/common/GlassButton";
import { GlassCard } from "@/components/common/GlassCard";
import { cn } from "@/lib/utils";
import { DS } from "@/theme/design-system";

export interface ChatAttachment {
  id: string;           // 临时 ID
  file: File;
  previewUrl: string;   // blob URL
}

interface ChatInputBarProps {
  sending: boolean;
  onSend: (content: string, attachments?: File[]) => Promise<void> | void;
}

export function ChatInputBar({ sending, onSend }: ChatInputBarProps) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSend = async () => {
    const text = value.trim();
    if (!text && attachments.length === 0) return;
    
    const files = attachments.map(a => a.file);
    setValue("");
    // 清理附件并释放 blob URL
    attachments.forEach(a => URL.revokeObjectURL(a.previewUrl));
    setAttachments([]);
    
    await onSend(text, files.length > 0 ? files : undefined);
  };

  // 处理图片选择
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: ChatAttachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      
      newAttachments.push({
        id: `${Date.now()}-${i}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    setAttachments(prev => [...prev, ...newAttachments]);
    // 重置 input 以便可以重复选择同一文件
    e.target.value = "";
  };

  // 移除附件
  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => {
      const att = prev.find(a => a.id === id);
      if (att) URL.revokeObjectURL(att.previewUrl);
      return prev.filter(a => a.id !== id);
    });
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      await handleSend();
    }
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 192)}px`;
  }, [value]);

  const hasAttachments = attachments.length > 0;

  return (
    <div className="flex flex-col gap-2 w-full max-w-4xl mx-auto">
      {/* 附件预览区 */}
      {hasAttachments && (
        <div className="flex gap-2 flex-wrap px-2">
          {attachments.map(att => (
            <div 
              key={att.id} 
              className="relative group"
            >
              <img 
                src={att.previewUrl} 
                alt="附件预览" 
                className="h-16 w-16 object-cover rounded-lg border border-white/20 shadow-sm"
              />
              <button
                type="button"
                onClick={() => handleRemoveAttachment(att.id)}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 输入区 */}
      <div className="flex items-center gap-2">
        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleImageSelect}
        />

        {/* 图片上传按钮 - 移到输入框外面 */}
        <GlassButton
          type="button"
          size="icon"
          glassVariant="lite"
          onClick={() => fileInputRef.current?.click()}
          className="h-11 w-11 rounded-full shrink-0"
          title="添加图片"
        >
          <ImagePlus className="h-4 w-4 text-foreground/80" />
        </GlassButton>

        {/* 输入框 */}
        <GlassCard 
          variant="strong" 
          className={cn(
            "flex-1 p-0 transition-all duration-300 border-white/20 min-h-[48px]",
            DS.radius.full,
            focused && "ring-2 ring-primary/20 border-primary/30 shadow-lg shadow-primary/5"
          )}
        >
          <div className="relative w-full px-4 py-3">
            <Textarea
              ref={textareaRef}
              rows={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="输入消息..."
              className="min-h-[24px] max-h-48 w-full resize-none border-0 bg-transparent px-0 py-0 text-sm shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-foreground/40"
            />
            <div className="absolute right-3 bottom-3 text-[10px] text-foreground/60 pointer-events-none hidden md:block">
              Ctrl + Enter 发送
            </div>
          </div>
        </GlassCard>

        {/* 发送按钮 */}
        <GlassButton
          type="button"
          size="icon"
          glassVariant="lite"
          onClick={handleSend}
          disabled={sending || (!value.trim() && attachments.length === 0)}
          className="h-11 w-11 rounded-full shrink-0"
          aria-label="发送消息"
        >
          {sending ? (
            <Square className="h-4 w-4 text-foreground/80" />
          ) : (
            <Send className="h-4 w-4 text-primary" />
          )}
        </GlassButton>
      </div>
    </div>
  );
}
