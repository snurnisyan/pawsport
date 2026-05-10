import { Schema, model, type HydratedDocument, type Types } from "mongoose";

export const PET_SEXES = ["male", "female", "unknown"] as const;

export type PetSex = (typeof PET_SEXES)[number];

export interface IVetContact {
  name?: string;
  phone?: string;
  email?: string;
}

export interface IPet {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  name: string;
  species: string;
  breed?: string;
  birthDate?: Date;
  sex: PetSex;
  weight?: number;
  photoFileId?: Types.ObjectId;
  microchipNumber?: string;
  tags: string[];
  notes: string[];
  vetContact?: IVetContact;
  createdAt: Date;
  updatedAt: Date;
}

export type PetDocument = HydratedDocument<IPet>;

const vetContactSchema = new Schema<IVetContact>(
  {
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true }
  },
  { _id: false }
);

const petSchema = new Schema<IPet>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    species: {
      type: String,
      required: true,
      trim: true
    },
    breed: {
      type: String,
      trim: true
    },
    birthDate: {
      type: Date
    },
    sex: {
      type: String,
      enum: PET_SEXES,
      default: "unknown",
      required: true
    },
    weight: {
      type: Number,
      min: 0
    },
    photoFileId: {
      type: Schema.Types.ObjectId,
      ref: "File"
    },
    microchipNumber: {
      type: String,
      trim: true,
      match: /^\d{15}$/
    },
    tags: {
      type: [String],
      default: []
    },
    notes: {
      type: [String],
      default: []
    },
    vetContact: {
      type: vetContactSchema
    }
  },
  {
    timestamps: true,
    collection: "pets"
  }
);

petSchema.index({ ownerId: 1, name: 1 });
petSchema.index({ microchipNumber: 1 }, { sparse: true });

export const PetModel = model<IPet>("Pet", petSchema);
