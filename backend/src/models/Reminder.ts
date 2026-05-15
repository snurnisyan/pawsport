import { Schema, model, type HydratedDocument, type Types } from "mongoose";

import { REMINDER_OFFSETS, type ReminderOffset } from "./Event";

export const REMINDER_CHANNELS = ["email"] as const;
export const REMINDER_STATUSES = ["pending", "sent", "failed", "cancelled"] as const;

export type ReminderChannel = (typeof REMINDER_CHANNELS)[number];
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

export interface IReminder {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  petId: Types.ObjectId;
  eventId: Types.ObjectId;
  channel: ReminderChannel;
  dueAt: Date;
  sendAt: Date;
  offset: ReminderOffset;
  status: ReminderStatus;
  lastError?: string;
  processingToken?: string;
  processingStartedAt?: Date;
  processingExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type ReminderDocument = HydratedDocument<IReminder>;

const reminderSchema = new Schema<IReminder>(
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
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true
    },
    channel: {
      type: String,
      enum: REMINDER_CHANNELS,
      default: "email",
      required: true
    },
    dueAt: {
      type: Date,
      required: true,
      index: true
    },
    sendAt: {
      type: Date,
      required: true,
      index: true
    },
    offset: {
      type: String,
      enum: REMINDER_OFFSETS,
      required: true
    },
    status: {
      type: String,
      enum: REMINDER_STATUSES,
      default: "pending",
      required: true,
      index: true
    },
    lastError: {
      type: String
    },
    processingToken: {
      type: String
    },
    processingStartedAt: {
      type: Date
    },
    processingExpiresAt: {
      type: Date,
      index: true
    }
  },
  {
    timestamps: true,
    collection: "reminders"
  }
);

reminderSchema.index({ status: 1, sendAt: 1 });
reminderSchema.index({ status: 1, sendAt: 1, processingExpiresAt: 1 });
reminderSchema.index({ ownerId: 1, petId: 1, dueAt: 1 });

export const ReminderModel = model<IReminder>("Reminder", reminderSchema);
