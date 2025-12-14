import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { DS } from "@/theme/design-system"
import { GlassIconButton } from "@/components/common/button/GlassButton"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/5 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 dark:bg-black/40",
        className
      )}
      {...props}
    />
  )
}

interface DialogContentProps extends React.ComponentProps<typeof DialogPrimitive.Content> {
  showCloseButton?: boolean
  leftButtonIcon?: React.ReactNode
  onLeftButtonClick?: () => void
  leftButtonGlassVariant?: "strong" | "lite"
  rightButton?: React.ReactNode
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  leftButtonIcon,
  onLeftButtonClick,
  leftButtonGlassVariant = "lite",
  rightButton,
  ...props
}: DialogContentProps) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 border p-6 shadow-2xl duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:max-w-lg",
          "rounded-3xl",
          "button-rect:rounded-xl",
          DS.glass.strong,
          "border-white/20 dark:border-white/10",
          className
        )}
        {...props}
      >
        {children}
        {leftButtonIcon && (
          <GlassIconButton
            glassVariant={leftButtonGlassVariant}
            className="absolute top-4 left-4"
            onClick={onLeftButtonClick}
          >
            {leftButtonIcon}
          </GlassIconButton>
        )}

        {(rightButton || showCloseButton) && (
          <div className="absolute top-4 right-4">
            {rightButton
              ? rightButton
              : (
                <DialogPrimitive.Close data-slot="dialog-close" asChild>
                  <GlassIconButton
                    glassVariant="lite"
                  >
                    <XIcon className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </GlassIconButton>
                </DialogPrimitive.Close>
              )}
          </div>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

interface DialogFooterProps extends React.ComponentProps<"div"> {
  leftButtonIcon?: React.ReactNode
  onLeftButtonClick?: () => void
  leftButtonGlassVariant?: "strong" | "lite"
  rightButtonIcon?: React.ReactNode
  onRightButtonClick?: () => void
  rightButtonGlassVariant?: "strong" | "lite"
}

function DialogFooter({
  className,
  children,
  leftButtonIcon,
  onLeftButtonClick,
  leftButtonGlassVariant = "lite",
  rightButtonIcon,
  onRightButtonClick,
  rightButtonGlassVariant = "lite",
  ...props
}: DialogFooterProps) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex items-center justify-between gap-2",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        {leftButtonIcon && (
          <GlassIconButton
            type="button"
            glassVariant={leftButtonGlassVariant}
            onClick={onLeftButtonClick}
          >
            {leftButtonIcon}
          </GlassIconButton>
        )}
      </div>

      <div className="flex items-center gap-2">
        {children}
        {rightButtonIcon && (
          <GlassIconButton
            type="button"
            glassVariant={rightButtonGlassVariant}
            onClick={onRightButtonClick}
          >
            {rightButtonIcon}
          </GlassIconButton>
        )}
      </div>
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none", DS.text.heading, className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
