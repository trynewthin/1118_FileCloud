import type React from "react";
import { Download, XIcon } from "lucide-react";

import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/common/dialog/dialog";
import { DS } from "@/theme/design-system";
import { cn } from "@/lib/utils";

export interface PreviewDialogAdapter {
  title?: string | null;
  downloadUrl?: string | null;
  render: (options: { open: boolean }) => React.ReactNode;
}

export interface PreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adapter: PreviewDialogAdapter;
}

export function PreviewDialog({ open, onOpenChange, adapter }: PreviewDialogProps) {
  const title = adapter.title;
  const downloadUrl = adapter.downloadUrl ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("p-0! gap-0! sm:max-w-[880px]", cn(DS.radius.xl, "button-rect:rounded-lg"))} showCloseButton={false}>
        <div className="px-5 pt-5 pb-3 border-b border-white/10">
          <DialogTitle className="text-base">{title || "预览"}</DialogTitle>
        </div>

        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
          {adapter.render({ open })}
        </div>

        <div className="px-5 pb-4">
          <DialogFooter
            leftButtonIcon={<XIcon className="h-4 w-4" />}
            onLeftButtonClick={() => onOpenChange(false)}
            leftButtonGlassVariant="lite"
            rightButtonIcon={downloadUrl ? <Download className="h-4 w-4" /> : undefined}
            onRightButtonClick={
              downloadUrl
                ? () => {
                    window.open(downloadUrl, "_blank");
                  }
                : undefined
            }
            rightButtonGlassVariant="lite"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
