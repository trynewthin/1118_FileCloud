import { 
  FolderOpen, 
  CheckSquare, 
  Settings, 
  History,
  HardDrive
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
    title: "任务",
    href: "/tasks",
    icon: CheckSquare,
    match: /^\/tasks/,
  },
  {
    title: "日志",
    href: "/logs",
    icon: History,
    match: /^\/logs/,
  },
  {
    title: "设置",
    href: "/settings",
    icon: Settings,
    match: /^\/settings/,
  },
];
