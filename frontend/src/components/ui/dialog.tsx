import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { DS } from "@/lib/design-system"
import { GlassButton } from "@/components/common/GlassButton"

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
  leftButtonGlassVariant?: "strong" | "lite" | "ghost"
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
          DS.radius.xl,
          DS.glass.strong,
          "border-white/20 dark:border-white/10",
          className
        )}
        {...props}
      >
        {children}
        {leftButtonIcon && (
          <GlassButton
            size="icon"
            glassVariant={leftButtonGlassVariant}
            className="absolute top-4 left-4"
            onClick={onLeftButtonClick}
          >
            {leftButtonIcon}
          </GlassButton>
        )}

        {(rightButton || showCloseButton) && (
          <div className="absolute top-4 right-4">
            {rightButton
              ? rightButton
              : (
                <DialogPrimitive.Close data-slot="dialog-close" asChild>
                  <GlassButton
                    size="icon"
                    glassVariant="lite"
                  >
                    <XIcon className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </GlassButton>
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
  leftButtonGlassVariant?: "strong" | "lite" | "ghost"
  rightButtonIcon?: React.ReactNode
  onRightButtonClick?: () => void
  rightButtonGlassVariant?: "strong" | "lite" | "ghost"
}

function DialogFooter({
  className,
  children,
  leftButtonIcon,
  onLeftButtonClick,
  leftButtonGlassVariant = "ghost",
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
          <GlassButton
            type="button"
            size="icon"
            glassVariant={leftButtonGlassVariant}
            onClick={onLeftButtonClick}
          >
            {leftButtonIcon}
          </GlassButton>
        )}
      </div>

      <div className="flex items-center gap-2">
        {children}
        {rightButtonIcon && (
          <GlassButton
            type="button"
            size="icon"
            glassVariant={rightButtonGlassVariant}
            onClick={onRightButtonClick}
          >
            {rightButtonIcon}
          </GlassButton>
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
