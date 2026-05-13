import assert from "node:assert/strict";
import http from "node:http";
import { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";

import { env } from "../src/config/env";
import { authMiddleware, type AuthenticatedRequest } from "../src/middleware/authMiddleware";
import { errorHandler } from "../src/middleware/errorHandler";

const buildApp = () => {
  const app = express();
  app.get("/protected", authMiddleware, (req: AuthenticatedRequest, res) => {
    res.status(200).json({ userId: req.user?.id, email: req.user?.email });
  });
  app.use(errorHandler);
  return app;
};

const withServer = async <T>(fn: (baseUrl: string) => Promise<T>): Promise<T> => {
  const server = http.createServer(buildApp());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
};

test("authMiddleware returns 401 when no Authorization header is sent", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/protected`);
    assert.equal(res.status, 401);
    const body = (await res.json()) as { error: { code: string } };
    assert.equal(body.error.code, "UNAUTHORIZED");
  });
});

test("authMiddleware returns 401 for invalid JWT", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/protected`, {
      headers: { Authorization: "Bearer broken.token.here" }
    });
    assert.equal(res.status, 401);
    const body = (await res.json()) as { error: { code: string } };
    assert.equal(body.error.code, "UNAUTHORIZED");
  });
});

test("authMiddleware lets a request through when JWT is valid", async () => {
  const token = jwt.sign({ sub: "507f1f77bcf86cd799439011", email: "user@example.com" }, env.JWT_SECRET);

  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/protected`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { userId: string; email: string };
    assert.equal(body.userId, "507f1f77bcf86cd799439011");
    assert.equal(body.email, "user@example.com");
  });
});
