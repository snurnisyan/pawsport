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
