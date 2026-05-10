import type { RequestHandler } from "express";

export const notImplemented = (resource: string, action: string): RequestHandler => {
  return (_req, res) => {
    res.status(501).json({
      error: {
        code: "NOT_IMPLEMENTED",
        message: `${resource}.${action} is not implemented yet`,
        resource,
        action
      }
    });
  };
};
