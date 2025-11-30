// AI 聊天相关的共享类型

// 本地附件类型（用于临时消息显示和上传）
export interface LocalAttachment {
  id: string;
  previewUrl: string;
  file?: File;  // 原始文件（用于上传）
}
