import { PageContainer } from "@/components/layout/PageContainer";

export const TestPlaygroundPage = () => {
  return (
    <PageContainer title="测试组件试验场" showBack>
      <div className="flex flex-col gap-4 p-1 text-sm text-muted-foreground">
        <p>这里是测试页面，用于临时挂载和调试各类组件。</p>
        <p>后续可以在此处自由添加测试区域，而不影响正式页面。</p>
      </div>
    </PageContainer>
  );
};
