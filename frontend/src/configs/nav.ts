import {
  FolderOpen,
  Settings,
  HardDrive,
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
    title: "设置",
    href: "/settings",
    icon: Settings,
    match: /^\/settings/,
  },
];
