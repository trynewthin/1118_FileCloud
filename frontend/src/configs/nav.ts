import {
  Home,
  FolderOpen,
  ListChecks,
  Settings,
  Sparkles,
  Tag,
} from "lucide-react";

export const navItems = [
  {
    title: "首页",
    href: "/",
    icon: Home,
    match: /^\/$/,
  },
  {
    title: "文件",
    href: "/files",
    icon: FolderOpen,
    match: /^\/(files|preview|tags\/browse)/,
  },
  {
    title: "标签",
    href: "/tags",
    icon: Tag,
    match: /^\/tags(?!\/browse)/,
  },
  {
    title: "AI 助手",
    href: "/ai",
    icon: Sparkles,
    match: /^\/ai/,
  },
  {
    title: "任务",
    href: "/settings/tasks",
    icon: ListChecks,
    match: /^\/settings\/tasks/,
  },
  {
    title: "设置",
    href: "/settings",
    icon: Settings,
    match: /^\/settings/,
  },
];
