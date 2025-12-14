import type { LucideIcon } from "lucide-react";
import {
  FILE_ICON_COMPONENTS,
  FILE_ICON_DEFAULT_COMPONENT,
  type FileIconGroupKey,
} from "@/configs/fileTypeIcons";

export type SkeuoFileTypeKey = FileIconGroupKey | "default";

export interface SkeuoFileStyleTokens {
  bgFrom: string;
  bgMid: string;
  bgTo: string;
  iconColor: string;
  highlight: string;
}

export const SKEUO_FILE_STYLE_TOKENS: Record<SkeuoFileTypeKey, SkeuoFileStyleTokens> = {
  image: {
    bgFrom: "#eff6ff",
    bgMid: "#dbeafe",
    bgTo: "#bfdbfe",
    iconColor: "#2563eb",
    highlight: "rgba(255,255,255,0.80)",
  },
  video: {
    bgFrom: "#fff7ed",
    bgMid: "#ffedd5",
    bgTo: "#fed7aa",
    iconColor: "#ea580c",
    highlight: "rgba(255,255,255,0.80)",
  },
  audio: {
    bgFrom: "#f5f3ff",
    bgMid: "#ede9fe",
    bgTo: "#ddd6fe",
    iconColor: "#6d28d9",
    highlight: "rgba(255,255,255,0.80)",
  },
  pdf: {
    bgFrom: "#fef2f2",
    bgMid: "#fee2e2",
    bgTo: "#fecaca",
    iconColor: "#dc2626",
    highlight: "rgba(255,255,255,0.80)",
  },
  archive: {
    bgFrom: "#fffbeb",
    bgMid: "#fef3c7",
    bgTo: "#fde68a",
    iconColor: "#b45309",
    highlight: "rgba(255,255,255,0.80)",
  },
  default: {
    bgFrom: "rgba(248,250,252,0.95)",
    bgMid: "rgba(241,245,249,0.85)",
    bgTo: "rgba(226,232,240,0.75)",
    iconColor: "rgba(15,23,42,0.55)",
    highlight: "rgba(255,255,255,0.75)",
  },
};

export function getSkeuoFileIconComponent(fileTypeKey: SkeuoFileTypeKey): LucideIcon {
  if (fileTypeKey === "default") return FILE_ICON_DEFAULT_COMPONENT;
  return FILE_ICON_COMPONENTS[fileTypeKey];
}
