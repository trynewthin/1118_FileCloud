import { buildApiUrl } from "./client";

const buildQuery = (params: Record<string, string | undefined>): string => {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      usp.set(key, value);
    }
  });
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
};

export const getFileStreamUrl = (entryId: string, password?: string): string => {
  return buildApiUrl(`/file-content/${entryId}/stream${buildQuery({ password })}`);
};

export const getFileThumbnailUrl = (entryId: string, password?: string): string => {
  return buildApiUrl(`/file-content/${entryId}/thumbnail${buildQuery({ password })}`);
};
