import type { RequestHandler } from "express";

export const multipartOnly = (handler: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    const contentType = req.headers["content-type"] ?? "";
    if (contentType.toLowerCase().startsWith("multipart/form-data")) {
      handler(req, res, next);
      return;
    }
    next();
  };
};
