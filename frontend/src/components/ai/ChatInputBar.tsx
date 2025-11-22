import { useEffect, useRef, useState } from "react";
import type React from "react";
import { Button } from "@/components/ui/button";
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

interface ChatInputBarProps {
  sending: boolean;
  onSend: (content: string) => Promise<void> | void;
  models?: AiChatModel[];
  currentModelId?: number | null;
  onChangeModel?: (modelId: number) => void;
}

export function ChatInputBar({ sending, onSend, models, currentModelId, onChangeModel }: ChatInputBarProps) {
  const [value, setValue] = useState("");
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
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <div className="rounded-2xl border bg-card px-3 py-2 shadow-sm">
          <Textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息，Ctrl+Enter 发送"
            className="min-h-[24px] max-h-48 w-full resize-none border-0 bg-transparent px-0 py-0 text-sm shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
      </div>

      {hasModelMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-9 w-9 rounded-full shadow-sm"
              aria-label="切换模型"
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs">
              当前模型：{currentModel ? currentModel.display_name : "未设置"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {models!.map((m) => (
              <DropdownMenuItem
                key={m.id}
                disabled={!m.is_enabled}
                className="text-xs"
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

      <Button
        type="button"
        size="icon"
        onClick={handleSend}
        disabled={sending}
        className={`h-9 w-9 shadow-sm ${sending ? "rounded-md" : "rounded-full"}`}
        aria-label="发送消息"
      >
        {sending ? <Square className="h-4 w-4" /> : <Send className="h-4 w-4" />}
      </Button>
    </div>
  );
}
