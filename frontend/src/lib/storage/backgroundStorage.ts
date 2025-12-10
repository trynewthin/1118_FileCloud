/**
 * 背景图片存储服务
 * 通过后端 API 存储和管理背景图片
 */

import { buildApiUrl, getAuthToken } from "@/lib/api/client";

export interface StoredBackgroundImage {
  id: string;
  name: string;
  size: number;
  createdAt: number;
}

interface UploadResponse {
  uploads: { id: string; name: string }[];
  errors?: string[];
}

interface ListResponse {
  images: StoredBackgroundImage[];
}

/**
 * 上传背景图片到后端
 */
export async function saveBackgroundImage(
  file: File
): Promise<StoredBackgroundImage> {
  const formData = new FormData();
  formData.append("images", file);

  const token = getAuthToken();
  const response = await fetch(buildApiUrl("/backgrounds"), {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "上传背景图片失败");
  }

  const data: UploadResponse = await response.json();
  if (data.uploads.length === 0) {
    throw new Error(data.errors?.[0] || "上传背景图片失败");
  }

  const uploaded = data.uploads[0];
  return {
    id: uploaded.id,
    name: uploaded.name,
    size: file.size,
    createdAt: Date.now(),
  };
}

/**
 * 获取所有背景图片列表
 */
export async function getAllBackgroundImages(): Promise<StoredBackgroundImage[]> {
  const token = getAuthToken();
  const response = await fetch(buildApiUrl("/backgrounds"), {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error("获取背景图片列表失败");
  }

  const data: ListResponse = await response.json();
  return data.images;
}

/**
 * 根据 ID 获取背景图片 URL
 * 注意：这里返回的是后端图片的 URL，不需要 revokeObjectURL
 */
export function getBackgroundImageUrl(id: string): string {
  return buildApiUrl(`/backgrounds/${id}`);
}

/**
 * 删除背景图片
 */
export async function deleteBackgroundImage(id: string): Promise<void> {
  const token = getAuthToken();
  const response = await fetch(buildApiUrl(`/backgrounds/${id}`), {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "删除背景图片失败");
  }
}

/**
 * 创建图片预览 URL
 * 对于后端存储的图片，直接返回 API URL
 */
export function createImageUrl(image: StoredBackgroundImage): string {
  return getBackgroundImageUrl(image.id);
}
