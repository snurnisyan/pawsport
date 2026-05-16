import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { EVENT_TYPES, RECURRENCE_FREQUENCIES, REMINDER_OFFSETS } from "../models/Event";
import { EXPORT_SECTIONS, EXPORT_STATUSES } from "../models/Export";
import { PET_SEXES } from "../models/Pet";
import { REMINDER_CHANNELS, REMINDER_STATUSES } from "../models/Reminder";
import { USER_STATUSES } from "../models/User";
import { ALLOWED_FILE_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "../middleware/uploadMiddleware";
import { ALLOWED_PHOTO_MIME_TYPES } from "../services/fileService";

extendZodWithOpenApi(z);

export const ObjectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/)
  .openapi("ObjectId", {
    example: "665f1a2b3c4d5e6f7890abcd"
  });

export const DateTimeSchema = z.string().datetime().openapi("DateTime", {
  example: "2026-05-12T10:00:00.000Z"
});

export const DateSchema = z.string().openapi({
  format: "date",
  example: "2026-05-12"
});

export const MessageResponseSchema = z
  .object({
    message: z.string()
  })
  .openapi("MessageResponse");

export const ErrorResponseSchema = z
  .object({
    error: z.object({
      code: z.string().openapi({ example: "NOT_FOUND" }),
      message: z.string().openapi({ example: "Resource was not found" })
    })
  })
  .openapi("ErrorResponse");

export const RegisterRequestSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8).openapi({ format: "password" }),
    personalDataConsent: z.boolean().openapi({
      description: "Must be true before account creation."
    })
  })
  .openapi("RegisterRequest");

export const LoginRequestSchema = z
  .object({
    email: z.string().email(),
    password: z.string().openapi({ format: "password" })
  })
  .openapi("LoginRequest");

export const PasswordResetRequestSchema = z
  .object({
    email: z.string().email()
  })
  .openapi("PasswordResetRequest");

export const PasswordResetValidateRequestSchema = z
  .object({
    token: z.string().min(1)
  })
  .openapi("PasswordResetValidateRequest");

export const PasswordResetConfirmRequestSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(8).openapi({ format: "password" })
  })
  .openapi("PasswordResetConfirmRequest");

export const ConfirmEmailQuerySchema = z
  .object({
    token: z.string()
  })
  .openapi("ConfirmEmailQuery");

export const AuthUserSchema = z
  .object({
    id: ObjectIdSchema,
    email: z.string().email(),
    emailVerified: z.boolean()
  })
  .openapi("AuthUser");

export const AuthResponseSchema = z
  .object({
    accessToken: z.string(),
    user: AuthUserSchema,
    nextStep: z.literal("onboarding")
  })
  .openapi("AuthResponse");

export const UserSchema = z
  .object({
    id: ObjectIdSchema,
    email: z.string().email(),
    status: z.enum(USER_STATUSES),
    emailVerified: z.boolean(),
    consentAcceptedAt: DateTimeSchema,
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema
  })
  .openapi("User");

export const UserResponseSchema = z
  .object({
    user: UserSchema
  })
  .openapi("UserResponse");

export const VetContactSchema = z
  .object({
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional()
  })
  .openapi("VetContact");

export const PetSchema = z
  .object({
    id: ObjectIdSchema,
    ownerId: ObjectIdSchema,
    name: z.string(),
    species: z.string().openapi({ example: "dog" }),
    breed: z.string().optional(),
    birthDate: DateSchema.optional(),
    sex: z.enum(PET_SEXES),
    weight: z.number().min(0).optional(),
    photoFileId: ObjectIdSchema.optional(),
    microchipNumber: z.string().regex(/^\d{15}$/).optional(),
    tags: z.array(z.string()),
    notes: z.array(z.string()),
    vetContact: VetContactSchema.optional(),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema
  })
  .openapi("Pet");

const PetMutableSchema = PetSchema.pick({
  name: true,
  species: true,
  breed: true,
  birthDate: true,
  sex: true,
  weight: true,
  photoFileId: true,
  microchipNumber: true,
  tags: true,
  notes: true,
  vetContact: true
});

export const CreatePetRequestSchema = PetMutableSchema.extend({
  sex: z.enum(PET_SEXES).default("unknown"),
  tags: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([])
}).openapi("CreatePetRequest");

export const UpdatePetRequestSchema = PetMutableSchema.partial().openapi("UpdatePetRequest");

export const PetResponseSchema = z
  .object({
    pet: PetSchema
  })
  .openapi("PetResponse");

export const PetListResponseSchema = z
  .object({
    items: z.array(PetSchema)
  })
  .openapi("PetListResponse");

export const RecurrenceSchema = z
  .object({
    frequency: z.enum(RECURRENCE_FREQUENCIES).default("none"),
    interval: z.number().int().min(1).optional()
  })
  .openapi("Recurrence");

export const EventSchema = z
  .object({
    id: ObjectIdSchema,
    ownerId: ObjectIdSchema,
    petId: ObjectIdSchema,
    type: z.enum(EVENT_TYPES),
    title: z.string(),
    eventDate: DateTimeSchema,
    nextDate: DateTimeSchema.optional(),
    clinicName: z.string().optional(),
    comment: z.string().optional(),
    recurrence: RecurrenceSchema.optional(),
    reminderOffset: z.enum(REMINDER_OFFSETS).optional().openapi({
      description:
        "When set, the backend maintains one pending email reminder for this event. Clearing it deletes the pending event reminder; sent reminders are left unchanged."
    }),
    fileIds: z.array(ObjectIdSchema),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema
  })
  .openapi("Event");

const EventMutableSchema = EventSchema.pick({
  type: true,
  title: true,
  eventDate: true,
  nextDate: true,
  clinicName: true,
  comment: true,
  recurrence: true,
  reminderOffset: true,
  fileIds: true
});

export const CreateEventRequestSchema = EventMutableSchema.extend({
  fileIds: z.array(ObjectIdSchema).default([])
}).openapi("CreateEventRequest");

export const UpdateEventRequestSchema = EventMutableSchema.partial().openapi("UpdateEventRequest");

export const EventResponseSchema = z
  .object({
    event: EventSchema
  })
  .openapi("EventResponse");

export const EventListResponseSchema = z
  .object({
    items: z.array(EventSchema)
  })
  .openapi("EventListResponse");

export const FileSchema = z
  .object({
    id: ObjectIdSchema,
    ownerId: ObjectIdSchema,
    petId: ObjectIdSchema,
    eventId: ObjectIdSchema.optional(),
    originalName: z.string(),
    mimeType: z.enum(ALLOWED_FILE_MIME_TYPES),
    sizeBytes: z.number().int().min(1).max(MAX_FILE_SIZE_BYTES),
    uploadedAt: DateTimeSchema,
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema
  })
  .openapi("File");

export const FileResponseSchema = z
  .object({
    file: FileSchema
  })
  .openapi("FileResponse");

export const FileListResponseSchema = z
  .object({
    items: z.array(FileSchema)
  })
  .openapi("FileListResponse");

export const UploadPetFileRequestSchema = z
  .object({
    file: z.string().openapi({ format: "binary" }),
    eventId: ObjectIdSchema.optional()
  })
  .openapi("UploadPetFileRequest");

export const UploadPetPhotoRequestSchema = z
  .object({
    file: z.string().openapi({
      format: "binary",
      description: `Pet photo image. Allowed types: ${ALLOWED_PHOTO_MIME_TYPES.join(", ")}.`
    })
  })
  .openapi("UploadPetPhotoRequest");

export const PetPhotoResponseSchema = z
  .object({
    pet: PetSchema,
    file: FileSchema
  })
  .openapi("PetPhotoResponse");

export const ReminderSchema = z
  .object({
    id: ObjectIdSchema,
    ownerId: ObjectIdSchema,
    petId: ObjectIdSchema,
    eventId: ObjectIdSchema.openapi({
      description: "Must reference an event owned by the authenticated user and belonging to the same petId."
    }),
    channel: z.enum(REMINDER_CHANNELS),
    dueAt: DateTimeSchema,
    sendAt: DateTimeSchema,
    offset: z.enum(REMINDER_OFFSETS),
    status: z.enum(REMINDER_STATUSES),
    lastError: z.string().optional(),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema
  })
  .openapi("Reminder");

export const CreateReminderRequestSchema = z
  .object({
    petId: ObjectIdSchema,
    eventId: ObjectIdSchema,
    channel: z.enum(REMINDER_CHANNELS).default("email"),
    dueAt: DateTimeSchema,
    sendAt: DateTimeSchema,
    offset: z.enum(REMINDER_OFFSETS)
  })
  .openapi("CreateReminderRequest");

export const UpdateReminderRequestSchema = CreateReminderRequestSchema.pick({
  dueAt: true,
  sendAt: true,
  offset: true
})
  .extend({
    status: z.enum(REMINDER_STATUSES).optional()
  })
  .partial()
  .openapi("UpdateReminderRequest");

export const ReminderResponseSchema = z
  .object({
    reminder: ReminderSchema
  })
  .openapi("ReminderResponse");

export const ReminderListResponseSchema = z
  .object({
    items: z.array(ReminderSchema)
  })
  .openapi("ReminderListResponse");

export const CalendarQuerySchema = z.object({
  from: DateSchema.optional(),
  to: DateSchema.optional(),
  petId: ObjectIdSchema.optional()
});

export const CalendarResponseSchema = z
  .object({
    events: z.array(EventSchema),
    reminders: z.array(ReminderSchema)
  })
  .openapi("CalendarResponse");

export const ExportPeriodSchema = z
  .object({
    from: DateSchema.optional(),
    to: DateSchema.optional()
  })
  .openapi("ExportPeriod");

export const ExportSchema = z
  .object({
    id: ObjectIdSchema,
    ownerId: ObjectIdSchema,
    petId: ObjectIdSchema,
    period: ExportPeriodSchema.optional(),
    sections: z.array(z.enum(EXPORT_SECTIONS)),
    fileKey: z.string().optional().openapi({
      description: "Non-guessable S3 key for the generated PDF report."
    }),
    downloadUrl: z.string().url().optional().openapi({
      description: "Temporary download URL for the generated PDF report."
    }),
    status: z.enum(EXPORT_STATUSES),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema
  })
  .openapi("Export");

export const CreateExportRequestSchema = z
  .object({
    period: ExportPeriodSchema.optional(),
    sections: z.array(z.enum(EXPORT_SECTIONS)).default(["profile", "events"]),
    notificationEmail: z.string().email().optional()
  })
  .partial()
  .openapi("CreateExportRequest");

export const ExportResponseSchema = z
  .object({
    export: ExportSchema
  })
  .openapi("ExportResponse");

export const IdPathParamsSchema = z.object({
  id: ObjectIdSchema
});
