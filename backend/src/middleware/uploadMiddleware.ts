import multer from "multer";

import { AppError } from "./errorHandler";

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export const ALLOWED_FILE_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"] as const;

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES
  },
  fileFilter: (_req, file, callback) => {
    if (ALLOWED_FILE_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_FILE_MIME_TYPES)[number])) {
      callback(null, true);
      return;
    }

    callback(new AppError(400, "UNSUPPORTED_FILE_TYPE", "file type is not supported"));
  }
});
