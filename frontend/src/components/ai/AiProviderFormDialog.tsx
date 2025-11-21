import { useEffect, useState } from "react";
import type { AiProvider, CreateAiProviderRequest } from "@/lib/api/aiConfig";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface AiProviderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProvider?: AiProvider;
  onSubmit: (data: CreateAiProviderRequest) => Promise<void>;
}

export function AiProviderFormDialog({
  open,
  onOpenChange,
  editingProvider,
  onSubmit,
}: AiProviderFormDialogProps) {
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiType, setApiType] = useState("openai_compatible");
  const [extraHeadersJson, setExtraHeadersJson] = useState("");
  const [timeoutMs, setTimeoutMs] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (editingProvider) {
      setName(editingProvider.name);
      setBaseUrl(editingProvider.base_url);
      setApiKey(editingProvider.api_key ?? "");
      setApiType(editingProvider.api_type);
      setExtraHeadersJson(editingProvider.extra_headers_json ?? "");
      setTimeoutMs(editingProvider.timeout_ms != null ? String(editingProvider.timeout_ms) : "");
    } else {
      setName("");
      setBaseUrl("");
      setApiKey("");
      setApiType("openai_compatible");
      setExtraHeadersJson("");
      setTimeoutMs("");
    }
  }, [editingProvider]);

  const handleSubmit = async () => {
    if (!name.trim() || !baseUrl.trim() || !apiType.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        apiKey: apiKey || null,
        apiType: apiType.trim(),
        extraHeadersJson: extraHeadersJson || null,
        timeoutMs: timeoutMs ? Number(timeoutMs) : null,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingProvider ? "编辑供应商" : "新建供应商"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="provider-name">名称</Label>
            <Input
              id="provider-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="provider-baseurl">Base URL</Label>
            <Input
              id="provider-baseurl"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="例如：https://api.openai.com"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="provider-apikey">API Key</Label>
            <Input
              id="provider-apikey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="provider-apitype">接口类型</Label>
            <Input
              id="provider-apitype"
              value={apiType}
              onChange={(e) => setApiType(e.target.value)}
              placeholder="例如：openai_compatible"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="provider-headers">额外请求头 JSON</Label>
            <Textarea
              id="provider-headers"
              value={extraHeadersJson}
              onChange={(e) => setExtraHeadersJson(e.target.value)}
              placeholder='可选，例如：{"x-foo":"bar"}'
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="provider-timeout">超时时间 (ms)</Label>
            <Input
              id="provider-timeout"
              type="number"
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting}>
            {editingProvider ? "保存" : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
