import { useEffect, useState } from "react";
import { useAiConfig } from "@/hooks/useAiConfig";
import { useSettings } from "@/hooks/useSettings";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, RefreshCw } from "lucide-react";
import { AiProviderList } from "@/components/ai/AiProviderList";
import { AiProviderFormDialog } from "@/components/ai/AiProviderFormDialog";
import { AiModelList } from "@/components/ai/AiModelList";
import { AiModelFormDialog } from "@/components/ai/AiModelFormDialog";
import { AiPromptList } from "@/components/ai/AiPromptList";
import { AiPromptFormDialog } from "@/components/ai/AiPromptFormDialog";
import type { AiProvider, AiChatModel, AiChatPrompt } from "@/lib/api/aiConfig";

export function AiSettingsPage() {
  const {
    providers,
    models,
    prompts,
    loading,
    error,
    reload,
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

  const { items: settings, update: updateSetting } = useSettings();

  const [activeTab, setActiveTab] = useState("providers");

  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AiProvider | undefined>(undefined);

  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<AiChatModel | undefined>(undefined);

  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<AiChatPrompt | undefined>(undefined);

  const defaultModelSetting = settings.find((s) => s.key === "ai.chat.defaultModelId");
  const parsedDefaultModelId = defaultModelSetting ? Number(defaultModelSetting.value) : NaN;
  const defaultModelId = Number.isInteger(parsedDefaultModelId) && parsedDefaultModelId > 0
    ? parsedDefaultModelId
    : null;

  const defaultModelSelectValue = defaultModelId ? String(defaultModelId) : "none";

  const handleChangeDefaultModel = async (value: string) => {
    const next = value === "none" ? "0" : value;
    await updateSetting("ai.chat.defaultModelId", next);
  };

  // 会话命名相关本地状态，用于编辑后统一保存
  const [namingContextLocal, setNamingContextLocal] = useState("1");
  const [namingPromptLocal, setNamingPromptLocal] = useState("");

  useEffect(() => {
    const ctx = settings.find((s) => s.key === "ai.chat.naming.contextMessages");
    const prompt = settings.find((s) => s.key === "ai.chat.naming.prompt");

    setNamingContextLocal(ctx?.value ?? "1");
    setNamingPromptLocal(prompt?.value ?? "");
  }, [settings]);

  const handleSaveNamingConfig = async () => {
    const ctxValue = namingContextLocal && namingContextLocal.trim().length > 0
      ? namingContextLocal
      : "1";
    await updateSetting("ai.chat.naming.contextMessages", ctxValue);
    await updateSetting("ai.chat.naming.prompt", namingPromptLocal ?? "");
  };

  const handleCreateProvider = () => {
    setEditingProvider(undefined);
    setProviderDialogOpen(true);
  };

  const handleEditProvider = (p: AiProvider) => {
    setEditingProvider(p);
    setProviderDialogOpen(true);
  };

  const handleDeleteProvider = async (id: number) => {
    if (confirm("确定要删除该供应商吗？")) {
      await deleteProvider(id);
    }
  };

  const handleCreateModel = () => {
    setEditingModel(undefined);
    setModelDialogOpen(true);
  };

  const handleEditModel = (m: AiChatModel) => {
    setEditingModel(m);
    setModelDialogOpen(true);
  };

  const handleDeleteModel = async (id: number) => {
    if (confirm("确定要删除该模型吗？")) {
      await deleteModel(id);
    }
  };

  const handleCreatePrompt = () => {
    setEditingPrompt(undefined);
    setPromptDialogOpen(true);
  };

  const handleEditPrompt = (p: AiChatPrompt) => {
    setEditingPrompt(p);
    setPromptDialogOpen(true);
  };

  const handleDeletePrompt = async (id: number) => {
    if (confirm("确定要删除该提示词吗？")) {
      await deletePrompt(id);
    }
  };

  const handleSetDefaultPrompt = async (id: number) => {
    await updatePrompt(id, { isDefault: true });
  };

  return (
    <PageContainer
      title="AI 设置"
      description="管理 AI 供应商、模型与提示词。"
      action={
        <Button variant="outline" size="sm" onClick={() => reload()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          刷新
        </Button>
      }
    >
      {error && <div className="mb-4 text-sm text-red-500">{error}</div>}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="providers">供应商</TabsTrigger>
          <TabsTrigger value="models">模型</TabsTrigger>
          <TabsTrigger value="prompts">提示词</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={handleCreateProvider}>
              <Plus className="mr-2 h-4 w-4" />
              新建供应商
            </Button>
          </div>
          <AiProviderList providers={providers} onEdit={handleEditProvider} onDelete={handleDeleteProvider} />
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>默认会话模型：</span>
              <Select value={defaultModelSelectValue} onValueChange={handleChangeDefaultModel}>
                <SelectTrigger className="h-8 w-56">
                  <SelectValue placeholder="请选择默认模型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不设置默认模型</SelectItem>
                  {models
                    .filter((m) => m.is_enabled)
                    .map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.display_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={handleCreateModel}>
              <Plus className="mr-2 h-4 w-4" />
              新建模型
            </Button>
          </div>

          <div className="rounded-md border bg-muted/40 p-4 space-y-3">
            <div className="text-sm font-medium">会话命名配置</div>
            <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)] items-start">
              <div className="space-y-1">
                <Label htmlFor="naming-context">命名上下文条数</Label>
                <Input
                  id="naming-context"
                  type="number"
                  min={1}
                  value={namingContextLocal}
                  onChange={(e) => setNamingContextLocal(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="naming-prompt">命名提示词</Label>
                <Textarea
                  id="naming-prompt"
                  value={namingPromptLocal}
                  onChange={(e) => setNamingPromptLocal(e.target.value)}
                  className="min-h-[80px] text-sm"
                  placeholder="可选。若不填写，将使用内置的中文默认提示进行会话命名。"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={handleSaveNamingConfig}>
                保存命名配置
              </Button>
            </div>
          </div>

          <AiModelList models={models} providers={providers} onEdit={handleEditModel} onDelete={handleDeleteModel} />
        </TabsContent>

        <TabsContent value="prompts" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={handleCreatePrompt}>
              <Plus className="mr-2 h-4 w-4" />
              新建提示词
            </Button>
          </div>
          <AiPromptList prompts={prompts} onEdit={handleEditPrompt} onDelete={handleDeletePrompt} onSetDefault={handleSetDefaultPrompt} />
        </TabsContent>
      </Tabs>

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
      />
    </PageContainer>
  );
}
