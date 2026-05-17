import { Schema, model, type HydratedDocument, type Types } from "mongoose";

export const EVENT_TYPES = ["vaccine", "treatment", "visit", "operation", "lab", "other"] as const;
export const VACCINE_SUBTYPES = ["complex", "rabies"] as const;
export const TREATMENT_SUBTYPES = ["internal", "external"] as const;
export const EVENT_SUBTYPES = [...VACCINE_SUBTYPES, ...TREATMENT_SUBTYPES] as const;
export const RECURRENCE_FREQUENCIES = ["none", "daily", "weekly", "monthly", "yearly", "custom"] as const;
export const REMINDER_OFFSETS = ["day", "week", "month"] as const;

export type EventType = (typeof EVENT_TYPES)[number];
export type VaccineSubtype = (typeof VACCINE_SUBTYPES)[number];
export type TreatmentSubtype = (typeof TREATMENT_SUBTYPES)[number];
export type EventSubtype = VaccineSubtype | TreatmentSubtype;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];
export type ReminderOffset = (typeof REMINDER_OFFSETS)[number];

export interface IRecurrence {
  frequency: RecurrenceFrequency;
  interval?: number;
}

export interface IEvent {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  petId: Types.ObjectId;
  type: EventType;
  subtype?: EventSubtype;
  title: string;
  eventDate: Date;
  nextDate?: Date;
  clinicName?: string;
  comment?: string;
  recurrence?: IRecurrence;
  reminderOffset?: ReminderOffset;
  fileIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export type EventDocument = HydratedDocument<IEvent>;

const recurrenceSchema = new Schema<IRecurrence>(
  {
    frequency: {
      type: String,
      enum: RECURRENCE_FREQUENCIES,
      default: "none",
      required: true
    },
    interval: {
      type: Number,
      min: 1
    }
  },
  { _id: false }
);

const eventSchema = new Schema<IEvent>(
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
    type: {
      type: String,
      enum: EVENT_TYPES,
      required: true,
      index: true
    },
    subtype: {
      type: String,
      enum: EVENT_SUBTYPES,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    eventDate: {
      type: Date,
      required: true,
      index: true
    },
    nextDate: {
      type: Date,
      index: true
    },
    clinicName: {
      type: String,
      trim: true
    },
    comment: {
      type: String,
      trim: true
    },
    recurrence: {
      type: recurrenceSchema
    },
    reminderOffset: {
      type: String,
      enum: REMINDER_OFFSETS
    },
    fileIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "File" }],
      default: []
    }
  },
  {
    timestamps: true,
    collection: "events"
  }
);

eventSchema.index({ ownerId: 1, petId: 1, eventDate: -1 });

export const EventModel = model<IEvent>("Event", eventSchema);
