import {
  FolderOpen,
  Settings,
  HardDrive,
  Sparkles,
} from "lucide-react";

export const navItems = [
  {
    title: "文件库",
    href: "/libraries",
    icon: HardDrive,
    match: /^\/libraries/,
  },
  {
    title: "浏览",
    href: "/files",
    icon: FolderOpen,
    match: /^\/files/,
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
