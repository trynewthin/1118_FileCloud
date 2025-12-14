import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAiConfig } from "@/hooks/useAiConfig";
import { PageContainer } from "@/components/layout/PageContainer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import { AiProviderList } from "@/components/settings/aisetting/AiProviderList";
import { AiProviderFormDialog } from "@/components/settings/aisetting/AiProviderFormDialog";
import { AiModelList } from "@/components/settings/aisetting/AiModelList";
import { AiModelFormDialog } from "@/components/settings/aisetting/AiModelFormDialog";
import { AiPromptList } from "@/components/settings/aisetting/AiPromptList";
import { AiPromptFormDialog } from "@/components/settings/aisetting/AiPromptFormDialog";
import type { AiProvider, AiChatModel, AiChatPrompt } from "@/lib/api/aiConfig";
import { GlassButton } from "@/components/common/button/GlassButton";

export function AiModelManagementPage() {
  const {
    providers,
    models,
    prompts,
    error,
    createProvider,
    updateProvider,
    deleteProvider,
    createModel,
    updateModel,
    deleteModel,
    createPrompt,
    updatePrompt,
    deletePrompt,
  } = useAiConfig();

  // 错误时显示 toast
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const [activeTab, setActiveTab] = useState("providers");

  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AiProvider | undefined>(undefined);

  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<AiChatModel | undefined>(undefined);

  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<AiChatPrompt | undefined>(undefined);

  const handleCreateProvider = () => {
    setEditingProvider(undefined);
    setProviderDialogOpen(true);
  };

  const handleEditProvider = (p: AiProvider) => {
    setEditingProvider(p);
    setProviderDialogOpen(true);
  };

  const handleCreateModel = () => {
    setEditingModel(undefined);
    setModelDialogOpen(true);
  };

  const handleEditModel = (m: AiChatModel) => {
    setEditingModel(m);
    setModelDialogOpen(true);
  };

  const handleCreatePrompt = () => {
    setEditingPrompt(undefined);
    setPromptDialogOpen(true);
  };

  const handleEditPrompt = (p: AiChatPrompt) => {
    setEditingPrompt(p);
    setPromptDialogOpen(true);
  };

  const handleSetDefaultPrompt = async (id: number) => {
    await updatePrompt(id, { isDefault: true });
  };

  // 根据当前 Tab 渲染对应的新建按钮
  const renderActionButton = () => {
    switch (activeTab) {
      case "providers":
        return (
          <GlassButton
            glassVariant="lite"
            size="sm"
            className="gap-2 px-3"
            onClick={handleCreateProvider}
          >
            <Plus className="h-4 w-4" />
            <span>新建供应商</span>
          </GlassButton>
        );
      case "models":
        return (
          <GlassButton
            glassVariant="lite"
            size="sm"
            className="gap-2 px-3"
            onClick={handleCreateModel}
          >
            <Plus className="h-4 w-4" />
            <span>新建模型</span>
          </GlassButton>
        );
      case "prompts":
        return (
          <GlassButton
            glassVariant="lite"
            size="sm"
            className="gap-2 px-3"
            onClick={handleCreatePrompt}
          >
            <Plus className="h-4 w-4" />
            <span>新建提示词</span>
          </GlassButton>
        );
      default:
        return null;
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <PageContainer
        title="模型管理"
        showBack
        headerCenter={
          <TabsList>
            <TabsTrigger value="providers">供应商</TabsTrigger>
            <TabsTrigger value="models">模型</TabsTrigger>
            <TabsTrigger value="prompts">提示词</TabsTrigger>
          </TabsList>
        }
        action={
          <div className="flex items-center gap-2">
            {renderActionButton()}
          </div>
        }
      >
        <div className="flex-1 min-h-0 flex flex-col">
          <TabsContent value="providers" className="mt-0">
            <AiProviderList providers={providers} onEdit={handleEditProvider} />
          </TabsContent>

          <TabsContent value="models" className="mt-0">
            <AiModelList
              models={models}
              providers={providers}
              onEdit={handleEditModel}
            />
          </TabsContent>

          <TabsContent value="prompts" className="mt-0">
            <AiPromptList
              prompts={prompts}
              onEdit={handleEditPrompt}
              onSetDefault={handleSetDefaultPrompt}
            />
          </TabsContent>
        </div>

        <AiProviderFormDialog
          open={providerDialogOpen}
          onOpenChange={setProviderDialogOpen}
          editingProvider={editingProvider}
          onSubmit={async (data) => {
            if (editingProvider) {
              await updateProvider(editingProvider.id, data);
            } else {
              await createProvider(data);
            }
          }}
          onDelete={async (id) => {
            await deleteProvider(id);
          }}
        />

        <AiModelFormDialog
          open={modelDialogOpen}
          onOpenChange={setModelDialogOpen}
          providers={providers}
          editingModel={editingModel}
          onSubmit={async (data) => {
            if (editingModel) {
              await updateModel(editingModel.id, data);
            } else {
              await createModel(data);
            }
          }}
          onDelete={async (id: number) => {
            await deleteModel(id);
          }}
        />

        <AiPromptFormDialog
          open={promptDialogOpen}
          onOpenChange={setPromptDialogOpen}
          editingPrompt={editingPrompt}
          onSubmit={async (data) => {
            if (editingPrompt) {
              await updatePrompt(editingPrompt.id, data);
            } else {
              await createPrompt(data);
            }
          }}
          onDelete={async (id) => {
            await deletePrompt(id);
          }}
        />
      </PageContainer>
    </Tabs>
  );
}
