import assert from "node:assert/strict";
import test from "node:test";

import { AppError } from "../src/middleware/errorHandler";
import { createAuthMiddleware, type AuthenticatedRequest } from "../src/middleware/authMiddleware";

type CapturedNext = (err?: unknown) => void;

const callMiddleware = (
  req: Partial<AuthenticatedRequest>,
  middleware: ReturnType<typeof createAuthMiddleware>
): Promise<{ req: AuthenticatedRequest; error: unknown }> => {
  return new Promise((resolve) => {
    const fullReq = {
      header: (name: string) =>
        (req.headers as Record<string, string> | undefined)?.[name.toLowerCase()],
      ...req
    } as AuthenticatedRequest;

    const next: CapturedNext = (err) => resolve({ req: fullReq, error: err });

    middleware(fullReq, {} as never, next);
  });
};

test("authMiddleware rejects request without Authorization header", async () => {
  const { error } = await callMiddleware({ headers: {} }, createAuthMiddleware());

  assert.ok(error instanceof AppError);
  assert.equal(error.statusCode, 401);
  assert.equal(error.code, "UNAUTHORIZED");
});

test("authMiddleware rejects non-Bearer scheme", async () => {
  const { error } = await callMiddleware(
    { headers: { authorization: "Basic abc" } },
    createAuthMiddleware()
  );

  assert.ok(error instanceof AppError);
  assert.equal(error.statusCode, 401);
});

test("authMiddleware rejects invalid token", async () => {
  const { error } = await callMiddleware(
    { headers: { authorization: "Bearer broken" } },
    createAuthMiddleware({
      verifyJwt: () => {
        throw new Error("bad signature");
      }
    })
  );

  assert.ok(error instanceof AppError);
  assert.equal(error.statusCode, 401);
  assert.equal(error.code, "UNAUTHORIZED");
});

test("authMiddleware attaches user from valid token", async () => {
  const userId = "507f1f77bcf86cd799439011";

  const { req, error } = await callMiddleware(
    { headers: { authorization: "Bearer good-token" } },
    createAuthMiddleware({
      verifyJwt: (token) => {
        assert.equal(token, "good-token");
        return { sub: userId, email: "user@example.com" };
      }
    })
  );

  assert.equal(error, undefined);
  assert.equal(req.user?.id, userId);
  assert.equal(req.user?.email, "user@example.com");
});

test("authMiddleware attaches user from auth cookie", async () => {
  const userId = "507f1f77bcf86cd799439011";

  const { req, error } = await callMiddleware(
    { headers: { cookie: "pawsport.access_token=cookie-token" } },
    createAuthMiddleware({
      verifyJwt: (token) => {
        assert.equal(token, "cookie-token");
        return { sub: userId, email: "user@example.com" };
      }
    })
  );

  assert.equal(error, undefined);
  assert.equal(req.user?.id, userId);
  assert.equal(req.user?.email, "user@example.com");
});

test("authMiddleware rejects payload without sub", async () => {
  const { error } = await callMiddleware(
    { headers: { authorization: "Bearer x" } },
    createAuthMiddleware({ verifyJwt: () => "string-payload" })
  );

  assert.ok(error instanceof AppError);
  assert.equal(error.statusCode, 401);
});
