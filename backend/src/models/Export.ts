import { Schema, model, type HydratedDocument, type Types } from "mongoose";

export const EXPORT_STATUSES = ["pending", "ready", "failed"] as const;
export const EXPORT_SECTIONS = ["profile", "events", "files", "reminders"] as const;

export type ExportStatus = (typeof EXPORT_STATUSES)[number];
export type ExportSection = (typeof EXPORT_SECTIONS)[number];

export interface IExportPeriod {
  from?: Date;
  to?: Date;
}

export interface IExport {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  petId: Types.ObjectId;
  period?: IExportPeriod;
  sections: ExportSection[];
  fileKey?: string;
  status: ExportStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type ExportDocument = HydratedDocument<IExport>;

const exportPeriodSchema = new Schema<IExportPeriod>(
  {
    from: { type: Date },
    to: { type: Date }
  },
  { _id: false }
);

const exportSchema = new Schema<IExport>(
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
    period: {
      type: exportPeriodSchema
    },
    sections: {
      type: [{ type: String, enum: EXPORT_SECTIONS }],
      default: ["profile", "events"]
    },
    fileKey: {
      type: String
    },
    status: {
      type: String,
      enum: EXPORT_STATUSES,
      default: "pending",
      required: true,
      index: true
    }
  },
  {
    timestamps: true,
    collection: "exports"
  }
);

export const ExportModel = model<IExport>("Export", exportSchema);
