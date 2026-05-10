import type { Request, RequestHandler } from "express";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

export const authMiddleware: RequestHandler = (_req, _res, next) => {
  next();
};
