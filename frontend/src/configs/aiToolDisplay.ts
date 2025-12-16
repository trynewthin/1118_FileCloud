export const TOOL_NAME_DISPLAY_MAP: Record<string, string> = {
  create_html_file: "创建 HTML 文件",
  create_markdown_file: "创建 Markdown 文件",
  get_current_time: "获取当前时间",
  list_libraries: "列出文件库",
  list_directory: "列出目录内容",
  rename_file: "重命名文件",
};

export const getToolDisplayName = (toolName: string): string => {
  return TOOL_NAME_DISPLAY_MAP[toolName] ?? toolName;
};
