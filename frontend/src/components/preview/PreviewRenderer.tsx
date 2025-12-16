import type { FileEntry } from "@/lib/api/files";

import { VideoPreview } from "@/components/preview/adapters/VideoPreview";
import { AudioPreview } from "@/components/preview/adapters/AudioPreview";
import { ImagePreview } from "@/components/preview/adapters/ImagePreview";
import { TextPreview } from "@/components/preview/adapters/TextPreview";
import { PdfPreview } from "@/components/preview/adapters/PdfPreview";
import { DefaultPreview } from "@/components/preview/adapters/DefaultPreview";

interface PreviewRendererProps {
  entry: FileEntry;
}

export function PreviewRenderer({ entry }: PreviewRendererProps) {
  const mime = entry.mime_type || "";
  const nameLower = entry.original_name.toLowerCase();
  const ext = nameLower.substring(nameLower.lastIndexOf("."));

  const videoExts = [".mp4", ".webm", ".mkv", ".mov", ".avi", ".m4v", ".wmv"];
  if (mime.startsWith("video/") || videoExts.includes(ext)) {
    return <VideoPreview entry={entry} />;
  }

  const audioExts = [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma", ".opus"];
  if (mime.startsWith("audio/") || audioExts.includes(ext)) {
    return <AudioPreview entry={entry} />;
  }

  const imageExts = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
    ".svg",
    ".ico",
    ".tiff",
    ".tif",
    ".heic",
    ".heif",
    ".avif",
  ];
  if (mime.startsWith("image/") || imageExts.includes(ext)) {
    return <ImagePreview entry={entry} />;
  }

  if (mime === "application/pdf" || ext === ".pdf") {
    return <PdfPreview entry={entry} />;
  }

  const textExts = [
    ".txt",
    ".md",
    ".markdown",
    ".json",
    ".xml",
    ".yaml",
    ".yml",
    ".log",
    ".ini",
    ".conf",
    ".cfg",
    ".env",
    ".js",
    ".ts",
    ".jsx",
    ".tsx",
    ".vue",
    ".svelte",
    ".css",
    ".scss",
    ".less",
    ".sass",
    ".html",
    ".htm",
    ".svg",
    ".py",
    ".rb",
    ".php",
    ".java",
    ".c",
    ".cpp",
    ".h",
    ".hpp",
    ".go",
    ".rs",
    ".swift",
    ".kt",
    ".scala",
    ".sh",
    ".bash",
    ".zsh",
    ".ps1",
    ".bat",
    ".cmd",
    ".sql",
    ".graphql",
    ".prisma",
    ".toml",
    ".csv",
    ".tsv",
  ];
  const textMimePatterns = [
    "text/",
    "application/json",
    "application/xml",
    "application/javascript",
  ];
  const isTextByMime = textMimePatterns.some((p) => mime.startsWith(p));
  if (isTextByMime || textExts.includes(ext)) {
    return <TextPreview entry={entry} />;
  }

  return <DefaultPreview entry={entry} />;
}
