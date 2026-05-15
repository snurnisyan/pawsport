import { randomBytes } from "node:crypto";

const DEFAULT_BYTES = 64;

const parsed = Number.parseInt(process.argv[2] ?? "", 10);
const byteLength = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BYTES;

const secret = randomBytes(byteLength).toString("base64url");

process.stdout.write(`JWT_SECRET=${secret}\n`);
