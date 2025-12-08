import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAiConfig } from "@/hooks/useAiConfig";
import { useSettings } from "@/hooks/useSettings";
import { PageContainer } from "@/components/layout/PageContainer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { DS } from "@/theme/design-system";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { SettingsItemCard } from "@/components/settings/SettingsItemCard";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { XIcon, ChevronRight } from "lucide-react";

export function AiSettingsPage() {
  const navigate = useNavigate();
  const { models } = useAiConfig();
  const { items: settings, update: updateSetting } = useSettings();

  const [namingDialogOpen, setNamingDialogOpen] = useState(false);

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

  return (
    <PageContainer title="AI 设置" showBack>
      <div className="flex-1 min-h-0 flex flex-col space-y-4">
        {/* 模型管理入口 */}
        <SettingsItemCard
          title="模型管理"
          description="管理 AI 供应商、模型和提示词"
          onClick={() => navigate("/settings/ai/models")}
        />

        {/* 会话配置 */}
        <div className="mt-4">
          <SettingsGroup title="会话配置">
            {/* 模型设置 */}
            <SettingsItemCard
              title="模型设置"
              action={
                <Select value={defaultModelSelectValue} onValueChange={handleChangeDefaultModel}>
                  <SelectTrigger className="h-9 w-[220px]">
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
              }
            />

            {/* 会话命名配置 */}
            <SettingsItemCard
              title="会话命名配置"
              onClick={() => setNamingDialogOpen(true)}
            />
          </SettingsGroup>
        </div>
      </div>

      {/* 会话命名配置对话框 */}
      <Dialog open={namingDialogOpen} onOpenChange={setNamingDialogOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-[500px]">
          <div className="space-y-4 py-2">
            <div className={cn("text-base", DS.text.heading)}>会话命名配置</div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="naming-context" className="text-sm text-muted-foreground">
                  命名上下文条数
                </Label>
                <Input
                  id="naming-context"
                  type="number"
                  min={1}
                  value={namingContextLocal}
                  onChange={(e) => setNamingContextLocal(e.target.value)}
                  className="h-9"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="naming-prompt" className="text-sm text-muted-foreground">
                  命名提示词
                </Label>
                <Textarea
                  id="naming-prompt"
                  value={namingPromptLocal}
                  onChange={(e) => setNamingPromptLocal(e.target.value)}
                  className="min-h-[120px] resize-none"
                  placeholder="可选。若不填写，将使用内置的中文默认提示进行会话命名。"
                />
              </div>
            </div>
          </div>
          
          <DialogFooter
            leftButtonIcon={<XIcon className="h-4 w-4" />}
            onLeftButtonClick={() => setNamingDialogOpen(false)}
            leftButtonGlassVariant="ghost"
            rightButtonIcon={<ChevronRight className="h-4 w-4" />}
            onRightButtonClick={async () => {
              await handleSaveNamingConfig();
              setNamingDialogOpen(false);
            }}
            rightButtonGlassVariant="lite"
          >
            <span className="text-xs text-muted-foreground">保存后立即生效</span>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
