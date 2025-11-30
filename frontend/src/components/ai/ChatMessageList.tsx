import type { AiChatMessage } from "@/lib/api/aiChat";
import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { DS } from "@/lib/design-system";

interface ChatMessageListProps {
  messages: AiChatMessage[];
  loading: boolean;
}

export function ChatMessageList({
  messages,
  loading,
}: ChatMessageListProps) {
  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      {loading && messages.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-muted-foreground/50 gap-3 animate-pulse">
          <Bot className="h-8 w-8 opacity-20" />
          <span className="text-xs">思考中...</span>
        </div>
      )}
      {!loading && messages.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-muted-foreground/50 gap-4">
          <div className="p-4 rounded-full bg-primary/5 border border-primary/10">
            <Bot className="h-8 w-8 text-primary/40" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium">AI 助手准备就绪</p>
            <p className="text-xs opacity-70">发送消息开始对话</p>
          </div>
        </div>
      )}
      
      {messages.map((m) => {
        const isAssistant = m.role === "assistant";
        const isSystem = m.role === "system";
        const isUser = m.role === "user";

        if (isSystem) {
          return (
            <div key={m.id} className="flex w-full justify-center my-2">
              <div className="bg-muted/30 backdrop-blur-sm border border-white/5 rounded-full px-3 py-1 text-[10px] text-muted-foreground">
                {m.content || "系统消息"}
              </div>
            </div>
          );
        }

        return (
          <div
            key={m.id}
            className={cn(
              "flex w-full gap-3",
              isUser ? "justify-end" : "justify-start"
            )}
          >
            {isAssistant && (
              <div className="shrink-0 h-8 w-8 rounded-full bg-primary/10 border border-primary/10 flex items-center justify-center text-primary shadow-sm mt-1">
                <Bot className="h-4 w-4" />
              </div>
            )}

            <div
              className={cn(
                "relative max-w-[85%] md:max-w-[75%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap shadow-sm transition-all",
                DS.radius.xl,
                isUser
                  ? "bg-linear-to-br from-blue-500 to-blue-600 text-white rounded-tr-sm shadow-blue-500/20"
                  : "bg-white/80 dark:bg-zinc-800/80 backdrop-blur-md border border-black/5 dark:border-white/10 text-foreground rounded-tl-sm"
              )}
            >
              {m.content}
            </div>

            {isUser && (
              <div className="shrink-0 h-8 w-8 rounded-full bg-muted/30 flex items-center justify-center text-muted-foreground mt-1">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        );
      })}
      
      {/* Loading Indicator at bottom */}
      {loading && messages.length > 0 && (
        <div className="flex w-full justify-start gap-3">
           <div className="shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary mt-1">
              <Bot className="h-4 w-4" />
           </div>
           <div className={cn("px-4 py-3 bg-background/40 backdrop-blur-md border border-white/5 rounded-2xl rounded-tl-sm")}>
             <div className="flex gap-1">
               <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
               <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
               <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
             </div>
           </div>
        </div>
      )}
    </div>
  );
}
