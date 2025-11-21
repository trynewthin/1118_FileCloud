import { useState } from "react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputBarProps {
  sending: boolean;
  onSend: (content: string) => Promise<void> | void;
}

export function ChatInputBar({ sending, onSend }: ChatInputBarProps) {
  const [value, setValue] = useState("");

  const handleSend = async () => {
    const text = value.trim();
    if (!text) return;
    await onSend(text);
    setValue("");
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      await handleSend();
    }
  };

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入消息，Ctrl+Enter 发送"
        className="min-h-[80px] text-sm"
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={handleSend} disabled={sending}>
          {sending ? "发送中..." : "发送"}
        </Button>
      </div>
    </div>
  );
}
