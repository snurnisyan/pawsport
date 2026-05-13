import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  public constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, "NOT_FOUND", `Route ${req.method} ${req.originalUrl} was not found`));
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  let statusCode = error instanceof AppError ? error.statusCode : 500;
  let code = error instanceof AppError ? error.code : "INTERNAL_SERVER_ERROR";
  let message = error instanceof Error ? error.message : "Unexpected error";

  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    statusCode = 400;
    code = "FILE_TOO_LARGE";
    message = "file exceeds the maximum allowed size";
  }

  res.status(statusCode).json({
    error: {
      code,
      message
    }
  });
};
