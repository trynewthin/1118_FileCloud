import { useEffect, useRef, useState } from "react";
import type React from "react";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Send, Sparkles, Square } from "lucide-react";
import type { AiChatModel } from "@/lib/api/aiConfig";
import { GlassButton } from "@/components/common/GlassButton";
import { GlassCard } from "@/components/common/GlassCard";
import { cn } from "@/lib/utils";
import { DS } from "@/lib/design-system";

interface ChatInputBarProps {
  sending: boolean;
  onSend: (content: string) => Promise<void> | void;
  models?: AiChatModel[];
  currentModelId?: number | null;
  onChangeModel?: (modelId: number) => void;
}

export function ChatInputBar({ sending, onSend, models, currentModelId, onChangeModel }: ChatInputBarProps) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleSend = async () => {
    const text = value.trim();
    if (!text) return;
    setValue("");
    await onSend(text);
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

  const hasModelMenu = models && models.length > 0 && !!onChangeModel;

  const currentModel = hasModelMenu
    ? models!.find((m) => m.id === currentModelId) ?? null
    : null;

  return (
    <div className="flex items-end gap-3 w-full max-w-4xl mx-auto px-2">
      {hasModelMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <GlassButton
              type="button"
              size="icon"
              glassVariant="lite"
              className="h-11 w-11 rounded-full shrink-0 mb-0.5"
              title={`切换模型 (${currentModel?.display_name ?? "未设置"})`}
            >
              <Sparkles className="h-5 w-5 text-primary" />
            </GlassButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={cn("w-56", DS.glass.strong, "border-white/10")}>
            <DropdownMenuLabel className="text-xs">
              当前模型：{currentModel ? currentModel.display_name : "未设置"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/10" />
            {models!.map((m) => (
              <DropdownMenuItem
                key={m.id}
                disabled={!m.is_enabled}
                className="text-xs focus:bg-primary/10 focus:text-primary"
                onClick={() => onChangeModel?.(m.id)}
              >
                <span className="truncate">
                  {m.display_name}
                  {!m.is_enabled ? "（已禁用）" : ""}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <GlassCard 
        variant="strong" 
        className={cn(
          "flex-1 p-0 transition-all duration-300 border-white/20 min-h-[48px] flex items-center",
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
            className="min-h-[24px] max-h-48 w-full resize-none border-0 bg-transparent px-0 py-0 text-sm shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/50"
          />
          <div className="absolute right-3 bottom-3 text-[10px] text-muted-foreground/40 pointer-events-none hidden md:block">
            Ctrl + Enter 发送
          </div>
        </div>
      </GlassCard>

      <GlassButton
        type="button"
        size="icon"
        glassVariant="lite"
        onClick={handleSend}
        disabled={sending || !value.trim()}
        className="h-11 w-11 rounded-full shrink-0 mb-0.5"
        aria-label="发送消息"
      >
        {sending ? (
          <Square className="h-5 w-5 text-muted-foreground" />
        ) : (
          <Send className="h-5 w-5 text-primary" />
        )}
      </GlassButton>
    </div>
  );
}
