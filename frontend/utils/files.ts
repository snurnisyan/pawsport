import { toaster } from "@/components/ui/toaster";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = "20 MB";

const isWithinUploadLimit = (file: File): boolean =>
  file.size <= MAX_UPLOAD_BYTES;

export const acceptFilesWithSizeGuard = (files: File[]): File[] => {
  const accepted: File[] = [];
  const rejected: File[] = [];
  for (const file of files) {
    if (isWithinUploadLimit(file)) accepted.push(file);
    else rejected.push(file);
  }

  if (rejected.length > 0) {
    toaster.error({
      title:
        rejected.length === 1
          ? `Файл больше ${MAX_UPLOAD_LABEL}`
          : `Несколько файлов больше ${MAX_UPLOAD_LABEL}`,
      description: rejected.map((file) => file.name).join(", "),
    });
  }

  return accepted;
};

export const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const saveUrl = (url: string, filename: string) => {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
