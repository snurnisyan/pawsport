import { Schema, model, type HydratedDocument, type Types } from "mongoose";

export const EXPORT_ARTIFACT_STATUSES = ["pending", "processing", "ready", "failed"] as const;

export type ExportArtifactStatus = (typeof EXPORT_ARTIFACT_STATUSES)[number];

export interface IExportArtifact {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  petId: Types.ObjectId;
  dataHash: string;
  fileKey?: string;
  status: ExportArtifactStatus;
  sourceExportId?: Types.ObjectId;
  expiresAt: Date;
  lastAccessedAt: Date;
  generation: number;
  renderClaimExpiresAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ExportArtifactDocument = HydratedDocument<IExportArtifact>;

const exportArtifactSchema = new Schema<IExportArtifact>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    petId: {
      type: Schema.Types.ObjectId,
      ref: "Pet",
      required: true,
      index: true
    },
    dataHash: {
      type: String,
      required: true,
      trim: true
    },
    fileKey: {
      type: String
    },
    status: {
      type: String,
      enum: EXPORT_ARTIFACT_STATUSES,
      default: "pending",
      required: true,
      index: true
    },
    sourceExportId: {
      type: Schema.Types.ObjectId,
      ref: "Export"
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    lastAccessedAt: {
      type: Date,
      required: true
    },
    generation: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    renderClaimExpiresAt: {
      type: Date
    },
    lastError: {
      type: String
    }
  },
  {
    timestamps: true,
    collection: "export_artifacts"
  }
);

exportArtifactSchema.index(
  { ownerId: 1, petId: 1, dataHash: 1 },
  { unique: true }
);
exportArtifactSchema.index({ status: 1, expiresAt: 1 });
exportArtifactSchema.index({ ownerId: 1, petId: 1, dataHash: 1, status: 1 });

export const ExportArtifactModel = model<IExportArtifact>(
  "ExportArtifact",
  exportArtifactSchema
);
