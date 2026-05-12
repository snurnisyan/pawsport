import { Router, type RequestHandler } from "express";
import type { RouteConfig } from "@asteasolutions/zod-to-openapi";

import { authMiddleware } from "../middleware/authMiddleware";
import { openApiRegistry } from "./openapi";
import { errorResponses } from "./routeContent";

type Method = RouteConfig["method"];
type RouteSpec = Omit<RouteConfig, "method" | "path" | "tags" | "security"> & {
  handlers: RequestHandler[];
};

const toOpenApiPath = (basePath: string, path: string): string => {
  const normalizedBase = basePath.replace(/:(\w+)/g, "{$1}");
  const normalizedPath = path.replace(/:(\w+)/g, "{$1}");

  if (normalizedPath === "" || normalizedPath === "/") {
    return normalizedBase || "/";
  }

  return `${normalizedBase}${normalizedPath}`;
};

export interface DocumentedRouter {
  router: Router;
  route: (method: Method, path: string, spec: RouteSpec) => void;
}

export const createDocumentedRouter = ({
  basePath,
  tags,
  auth = false,
  mergeParams = false
}: {
  basePath: string;
  tags: string[];
  auth?: boolean;
  mergeParams?: boolean;
}): DocumentedRouter => {
  const router = Router({ mergeParams });

  const route: DocumentedRouter["route"] = (method, path, { handlers, responses, ...rest }) => {
    router[method](path, ...(auth ? [authMiddleware, ...handlers] : handlers));

    openApiRegistry.registerPath({
      ...rest,
      method,
      path: toOpenApiPath(basePath, path),
      tags,
      ...(auth && { security: [{ bearerAuth: [] }] }),
      responses: {
        ...errorResponses({ auth, resource: /:\w+/.test(`${basePath}${path}`) }),
        ...responses
      }
    });
  };

  return { router, route };
};
