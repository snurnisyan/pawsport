import { Types } from "mongoose";

import { AppError } from "../middleware/errorHandler";
import { ExportModel, type IExport } from "../models/Export";
import { isMissingObjectError, s3Storage, type FileStorage } from "../storage/s3Storage";

type OwnerExportRecord = Pick<IExport, "_id" | "fileKey">;

export interface DeleteOwnerExportsDependencies {
  storage?: FileStorage;
  listOwnerExports?: (ownerId: Types.ObjectId) => Promise<OwnerExportRecord[]>;
  deleteOwnerExports?: (ownerId: Types.ObjectId) => Promise<void>;
}

export const deleteAllExportsForOwner = async (
  ownerId: Types.ObjectId,
  dependencies: DeleteOwnerExportsDependencies = {}
): Promise<void> => {
  const {
    storage = s3Storage,
    listOwnerExports = async (owner) =>
      ExportModel.find({ ownerId: owner })
        .select({ _id: 1, fileKey: 1 })
        .exec() as unknown as OwnerExportRecord[],
    deleteOwnerExports = async (owner) => {
      await ExportModel.deleteMany({ ownerId: owner }).exec();
    }
  } = dependencies;

  const exports = await listOwnerExports(ownerId);

  for (const record of exports) {
    if (!record.fileKey) {
      continue;
    }
    try {
      await storage.deleteObject({ key: record.fileKey });
    } catch (error) {
      if (!isMissingObjectError(error)) {
        throw new AppError(
          502,
          "EXPORT_STORAGE_DELETE_FAILED",
          "Could not delete export from storage"
        );
      }
    }
  }

  await deleteOwnerExports(ownerId);
};
