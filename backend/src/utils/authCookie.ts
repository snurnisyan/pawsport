import type { CookieOptions, Request } from "express";

import { env } from "../config/env";

export const AUTH_COOKIE_NAME = "pawsport.access_token";

const parseMaxAge = (value: string): number | undefined => {
  const match = value.trim().match(/^(\d+)(ms|s|m|h|d)?$/i);
  if (!match) return undefined;

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2]?.toLowerCase() ?? "ms";
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * multipliers[unit];
};

export const authCookieOptions = (): CookieOptions => {
  const maxAge = parseMaxAge(env.JWT_EXPIRES_IN);

  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    ...(maxAge ? { maxAge } : {}),
  };
};

export const clearAuthCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: "lax",
  secure: env.NODE_ENV === "production",
  path: "/",
});

export const getAuthCookie = (req: Request): string | undefined => {
  const cookieHeader = req.header("cookie");
  if (!cookieHeader) return undefined;

  const cookies = cookieHeader.split(";").map((item) => item.trim());
  const prefix = `${AUTH_COOKIE_NAME}=`;
  const rawCookie = cookies.find((item) => item.startsWith(prefix));
  if (!rawCookie) return undefined;

  const value = rawCookie.slice(prefix.length);
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};
