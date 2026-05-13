import type { Request, RequestHandler } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

import { env } from "../config/env";
import { AppError } from "./errorHandler";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

interface AuthMiddlewareDependencies {
  verifyJwt?: (token: string) => JwtPayload | string;
}

const defaultVerifyJwt = (token: string): JwtPayload | string => jwt.verify(token, env.JWT_SECRET);

export const createAuthMiddleware = ({
  verifyJwt = defaultVerifyJwt
}: AuthMiddlewareDependencies = {}): RequestHandler => {
  return (req: AuthenticatedRequest, _res, next) => {
    const header = req.header("authorization") ?? req.header("Authorization");

    if (!header) {
      next(new AppError(401, "UNAUTHORIZED", "Authorization header is required"));
      return;
    }

    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
      next(new AppError(401, "UNAUTHORIZED", "Authorization header must use Bearer scheme"));
      return;
    }

    try {
      const payload = verifyJwt(token);

      if (typeof payload !== "object" || payload === null || typeof payload.sub !== "string") {
        next(new AppError(401, "UNAUTHORIZED", "Invalid access token"));
        return;
      }

      req.user = {
        id: payload.sub,
        email: typeof payload.email === "string" ? payload.email : undefined
      };

      next();
    } catch {
      next(new AppError(401, "UNAUTHORIZED", "Invalid or expired access token"));
    }
  };
};

export const authMiddleware: RequestHandler = createAuthMiddleware();
