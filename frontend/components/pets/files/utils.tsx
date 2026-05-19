import type { ReactNode } from "react";
import { LuFile, LuFileImage, LuFileText } from "react-icons/lu";

export type TFileKind = "pdf" | "image" | "file";

export const FILE_TYPE_META: Record<
  TFileKind,
  { icon: ReactNode; bg: string; color: string }
> = {
  pdf: {
    icon: <LuFileText />,
    bg: "rgba(239, 68, 68, 0.15)",
    color: "#FCA5A5",
  },
  image: {
    icon: <LuFileImage />,
    bg: "rgba(59, 130, 246, 0.15)",
    color: "#93C5FD",
  },
  file: {
    icon: <LuFile />,
    bg: "rgba(16, 185, 129, 0.15)",
    color: "#6EE7B7",
  },
};

export const getFileKind = (mimeType: string): TFileKind => {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  return "file";
};

export const getFileTypeLabel = (mimeType: string): string => {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === "image/png") return "PNG";
  if (mimeType === "image/jpeg") return "JPG";
  return "FILE";
};
