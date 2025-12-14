import { PageContainer } from "@/components/layout/PageContainer";
import { SkeuoFolderItem } from "@/components/filebrowsepage/items/SkeuoFolderItem";
import { SkeuoFileItem } from "@/components/filebrowsepage/items/SkeuoFileItem";
import { Film, Image as ImageIcon, FolderOpen } from "lucide-react";

export const TestPlaygroundPage = () => {
  return (
    <PageContainer title="测试组件试验场" showBack>
      <div className="flex flex-col gap-3 p-1 text-sm text-muted-foreground">
        <p>这里是测试页面，用于临时挂载和调试各类组件。</p>
        <p>后续可以在此处自由添加测试区域，而不影响正式页面。</p>

        <div className="pt-2">
          <div className="mb-2 text-xs font-medium text-foreground/70">拟物化：文件夹</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-4">
            <SkeuoFolderItem name="剧集" subtitle="文件夹" scale={0.82} frontIcon={<Film className="h-5 w-5" />} />
            <SkeuoFolderItem
              name="照片"
              subtitle="蓝色主题"
              selected
              scale={0.82}
              frontIcon={<ImageIcon className="h-5 w-5" />}
              folderColor={{
                back: "#2563eb",
                tab: "#2563eb",
                tabNotch: "#2563eb",
                frontFrom: "#3b82f6",
                frontTo: "#60a5fa",
                frontTop: "#60a5fa",
                innerHighlight: "#93c5fd",
                innerShadow: "#1d4ed8",
              }}
            />
            <SkeuoFolderItem
              name="离线库"
              subtitle="文件夹（禁用态）"
              disabled
              scale={0.82}
              frontIcon={<FolderOpen className="h-5 w-5" />}
              folderColor={{
                back: "#64748b",
                tab: "#64748b",
                tabNotch: "#64748b",
                frontFrom: "#94a3b8",
                frontTo: "#cbd5e1",
                frontTop: "#cbd5e1",
                innerHighlight: "#e2e8f0",
                innerShadow: "#475569",
              }}
            />
          </div>
        </div>

        <div className="pt-2">
          <div className="mb-2 text-xs font-medium text-foreground/70">拟物化：文件</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-4">
            <SkeuoFileItem name="需求说明.docx" subtitle="128.4 KB" ext="docx" />
            <SkeuoFileItem name="合同.pdf" subtitle="860 KB" ext="pdf" selected />
            <SkeuoFileItem name="封面.jpg" subtitle="2.3 MB" ext="jpg" />
            <SkeuoFileItem name="预告片.mp4" subtitle="42.8 MB" ext="mp4" />
            <SkeuoFileItem name="素材.zip" subtitle="120 MB" ext="zip" />
          </div>
        </div>
      </div>
    </PageContainer>
  );
};
