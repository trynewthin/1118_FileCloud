import {
  FolderOpen,
  Settings,
  Sparkles,
  Tag,
} from "lucide-react";

export const navItems = [
  {
    title: "文件",
    href: "/files",
    icon: FolderOpen,
    match: /^\/(files|preview)/,
  },
  {
    title: "标签",
    href: "/tags",
    icon: Tag,
    match: /^\/tags/,
  },
  {
    title: "AI 助手",
    href: "/ai",
    icon: Sparkles,
    match: /^\/ai/,
  },
  {
    title: "设置",
    href: "/settings",
    icon: Settings,
    match: /^\/settings/,
  },
];
