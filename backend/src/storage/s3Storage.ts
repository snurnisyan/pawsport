import crypto from "node:crypto";
import { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";

import { env } from "../config/env";

export interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface GetObjectInput {
  key: string;
}

export interface DeleteObjectInput {
  key: string;
}

export interface StorageObject {
  body: Readable;
  contentType?: string;
  contentLength?: number;
}

export interface FileStorage {
  putObject(input: PutObjectInput): Promise<void>;
  getObject(input: GetObjectInput): Promise<StorageObject>;
  deleteObject(input: DeleteObjectInput): Promise<void>;
}

type TransformableBody = {
  transformToByteArray: () => Promise<Uint8Array>;
};

const s3Client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY
  }
});

export const isMissingObjectError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const candidate = error as {
    name?: unknown;
    Code?: unknown;
    code?: unknown;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    candidate.name === "NoSuchKey" ||
    candidate.Code === "NoSuchKey" ||
    candidate.code === "NoSuchKey" ||
    candidate.$metadata?.httpStatusCode === 404
  );
};

export const getPublicObjectUrl = (key: string): string => {
  const endpoint = new URL(env.S3_ENDPOINT);
  const encodedPath = [env.S3_BUCKET, ...key.split("/")].map(encodeURIComponent).join("/");
  endpoint.pathname = `${endpoint.pathname.replace(/\/+$/, "")}/${encodedPath}`;
  endpoint.search = "";
  endpoint.hash = "";
  return endpoint.toString();
};

const hmac = (key: Buffer | string, value: string): Buffer =>
  crypto.createHmac("sha256", key).update(value, "utf8").digest();

const sha256Hex = (value: string): string => crypto.createHash("sha256").update(value, "utf8").digest("hex");

const toAmzDate = (date: Date): { dateStamp: string; timestamp: string } => {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return {
    dateStamp: iso.slice(0, 8),
    timestamp: iso
  };
};

const encodeQueryValue = (value: string): string =>
  encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

export const getObjectDownloadUrl = (
  key: string,
  expiresInSeconds = 7 * 24 * 60 * 60,
  now = new Date()
): string => {
  const url = new URL(getPublicObjectUrl(key));
  const { dateStamp, timestamp } = toAmzDate(now);
  const credentialScope = `${dateStamp}/${env.S3_REGION}/s3/aws4_request`;
  const credential = `${env.S3_ACCESS_KEY_ID}/${credentialScope}`;
  const host = url.host;

  const query = new Map<string, string>([
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", credential],
    ["X-Amz-Date", timestamp],
    ["X-Amz-Expires", Math.min(expiresInSeconds, 7 * 24 * 60 * 60).toString()],
    ["X-Amz-SignedHeaders", "host"]
  ]);

  const canonicalQuery = [...query.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${encodeQueryValue(name)}=${encodeQueryValue(value)}`)
    .join("&");
  const canonicalRequest = [
    "GET",
    url.pathname,
    canonicalQuery,
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD"
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    timestamp,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join("\n");

  const dateKey = hmac(`AWS4${env.S3_SECRET_ACCESS_KEY}`, dateStamp);
  const regionKey = hmac(dateKey, env.S3_REGION);
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

  url.search = `${canonicalQuery}&X-Amz-Signature=${signature}`;
  return url.toString();
};

const toReadable = async (body: unknown): Promise<Readable> => {
  if (body instanceof Readable) {
    return body;
  }

  if (
    typeof body === "object" &&
    body !== null &&
    "transformToByteArray" in body &&
    typeof (body as TransformableBody).transformToByteArray === "function"
  ) {
    const bytes = await (body as TransformableBody).transformToByteArray();
    return Readable.from(Buffer.from(bytes));
  }

  throw new Error("S3 returned an unsupported object body");
};

export const s3Storage: FileStorage = {
  async putObject({ key, body, contentType }) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType
      })
    );
  },

  async getObject({ key }) {
    const result = await s3Client.send(
      new GetObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key
      })
    );

    return {
      body: await toReadable(result.Body),
      contentType: result.ContentType,
      contentLength: result.ContentLength
    };
  },

  async deleteObject({ key }) {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key
      })
    );
  }
};
