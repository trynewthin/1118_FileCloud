import type { FC } from "react";

// 测试组件试验场页面（独立于主布局）
export const TestPlaygroundPage: FC = () => {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="px-4 py-3 border-b border-border text-sm font-medium">
        测试组件试验场
      </header>
      <main className="flex-1 flex flex-col gap-4 p-4 text-sm text-muted-foreground">
        <p>这里是测试页面，用于临时挂载和调试各类组件。</p>
        <p>后续可以在此处自由添加测试区域，而不影响正式页面。</p>
      </main>
    </div>
  );
};
