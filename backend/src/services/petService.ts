import { Types, isValidObjectId } from "mongoose";

import { AppError } from "../middleware/errorHandler";
import { EventModel } from "../models/Event";
import { PetModel, PET_SEXES, type IPet, type PetSex } from "../models/Pet";
import { ReminderModel } from "../models/Reminder";
import { deleteAllExportsForPet } from "./exportService";
import { deleteAllFilesForPet } from "./fileService";

export interface CreatePetInput {
  name?: unknown;
  species?: unknown;
  breed?: unknown;
  birthDate?: unknown;
  sex?: unknown;
  weight?: unknown;
  photoFileId?: unknown;
  microchipNumber?: unknown;
  tags?: unknown;
  notes?: unknown;
  vetContact?: unknown;
}

export interface SerializedVetContact {
  name?: string;
  phone?: string;
  email?: string;
}

export interface SerializedPet {
  id: string;
  ownerId: string;
  name: string;
  species: string;
  breed?: string;
  birthDate?: string;
  sex: PetSex;
  weight?: number;
  photoFileId?: string;
  microchipNumber?: string;
  tags: string[];
  notes: string[];
  vetContact?: SerializedVetContact;
  createdAt: string;
  updatedAt: string;
}

type PetRecord = Pick<
  IPet,
  | "_id"
  | "ownerId"
  | "name"
  | "species"
  | "breed"
  | "birthDate"
  | "sex"
  | "weight"
  | "photoFileId"
  | "microchipNumber"
  | "tags"
  | "notes"
  | "vetContact"
  | "createdAt"
  | "updatedAt"
>;

interface NormalizedCreatePetInput {
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
  vetContact?: SerializedVetContact;
}

interface CreatePetPersistInput extends NormalizedCreatePetInput {
  ownerId: Types.ObjectId;
}

export interface PetUpdates {
  set: Record<string, unknown>;
  unset: string[];
}

export interface PetServiceDependencies {
  createPetRecord?: (input: CreatePetPersistInput) => Promise<PetRecord>;
  listPetsForOwner?: (ownerId: Types.ObjectId) => Promise<PetRecord[]>;
  findPetByIdForOwner?: (petId: Types.ObjectId, ownerId: Types.ObjectId) => Promise<PetRecord | null>;
  updatePetRecord?: (
    petId: Types.ObjectId,
    ownerId: Types.ObjectId,
    updates: PetUpdates
  ) => Promise<PetRecord | null>;
  findPetForDeletion?: (
    petId: Types.ObjectId,
    ownerId: Types.ObjectId
  ) => Promise<Pick<IPet, "_id"> | null>;
  deletePetRecord?: (petId: Types.ObjectId, ownerId: Types.ObjectId) => Promise<PetRecord | null>;
  deleteEventsForPet?: (petId: Types.ObjectId, ownerId: Types.ObjectId) => Promise<void>;
  deleteRemindersForPet?: (petId: Types.ObjectId, ownerId: Types.ObjectId) => Promise<void>;
  deleteFilesForPet?: (petId: Types.ObjectId, ownerId: Types.ObjectId) => Promise<void>;
  deleteExportsForPet?: (petId: Types.ObjectId, ownerId: Types.ObjectId) => Promise<void>;
}

const MICROCHIP_PATTERN = /^\d{15}$/;

const requireString = (value: unknown, code: string, message: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AppError(400, code, message);
  }
  return value.trim();
};

const optionalString = (value: unknown, code: string, message: string): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new AppError(400, code, message);
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseSex = (value: unknown): PetSex => {
  if (value === undefined || value === null) {
    return "unknown";
  }
  if (typeof value !== "string" || !(PET_SEXES as readonly string[]).includes(value)) {
    throw new AppError(400, "INVALID_SEX", `sex must be one of: ${PET_SEXES.join(", ")}`);
  }
  return value as PetSex;
};

const parseBirthDate = (value: unknown): Date | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new AppError(400, "INVALID_BIRTH_DATE", "birthDate must be an ISO date string");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, "INVALID_BIRTH_DATE", "birthDate must be a valid date");
  }
  return date;
};

const parseWeight = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new AppError(400, "INVALID_WEIGHT", "weight must be a non-negative number");
  }
  return value;
};

const parseObjectId = (value: unknown, code: string, message: string): Types.ObjectId | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string" || !isValidObjectId(value)) {
    throw new AppError(400, code, message);
  }
  return new Types.ObjectId(value);
};

const parseMicrochip = (value: unknown): string | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string" || !MICROCHIP_PATTERN.test(value)) {
    throw new AppError(400, "INVALID_MICROCHIP", "microchipNumber must be exactly 15 digits");
  }
  return value;
};

const parseStringArray = (value: unknown, code: string, fieldName: string): string[] => {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new AppError(400, code, `${fieldName} must be an array of strings`);
  }
  return value.map((item) => {
    if (typeof item !== "string") {
      throw new AppError(400, code, `${fieldName} must be an array of strings`);
    }
    return item.trim();
  });
};

const parseVetContact = (value: unknown): SerializedVetContact | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new AppError(400, "INVALID_VET_CONTACT", "vetContact must be an object");
  }

  const raw = value as Record<string, unknown>;
  const result: SerializedVetContact = {};

  const name = optionalString(raw.name, "INVALID_VET_CONTACT", "vetContact.name must be a string");
  if (name) result.name = name;

  const phone = optionalString(raw.phone, "INVALID_VET_CONTACT", "vetContact.phone must be a string");
  if (phone) result.phone = phone;

  const email = optionalString(raw.email, "INVALID_VET_CONTACT", "vetContact.email must be a string");
  if (email) result.email = email.toLowerCase();

  return Object.keys(result).length > 0 ? result : undefined;
};

const normalizeCreateInput = (input: CreatePetInput): NormalizedCreatePetInput => {
  return {
    name: requireString(input.name, "INVALID_NAME", "name is required"),
    species: requireString(input.species, "INVALID_SPECIES", "species is required"),
    breed: optionalString(input.breed, "INVALID_BREED", "breed must be a string"),
    birthDate: parseBirthDate(input.birthDate),
    sex: parseSex(input.sex),
    weight: parseWeight(input.weight),
    photoFileId: parseObjectId(input.photoFileId, "INVALID_PHOTO_FILE_ID", "photoFileId must be a valid id"),
    microchipNumber: parseMicrochip(input.microchipNumber),
    tags: parseStringArray(input.tags, "INVALID_TAGS", "tags"),
    notes: parseStringArray(input.notes, "INVALID_NOTES", "notes"),
    vetContact: parseVetContact(input.vetContact)
  };
};

const hasField = (input: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(input, key);

const normalizeUpdateInput = (input: CreatePetInput): PetUpdates => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { set: {}, unset: [] };
  }

  const set: Record<string, unknown> = {};
  const unset: string[] = [];

  if (hasField(input, "name")) {
    set.name = requireString(input.name, "INVALID_NAME", "name is required");
  }
  if (hasField(input, "species")) {
    set.species = requireString(input.species, "INVALID_SPECIES", "species is required");
  }
  if (hasField(input, "breed")) {
    const value = optionalString(input.breed, "INVALID_BREED", "breed must be a string");
    if (value) {
      set.breed = value;
    } else {
      unset.push("breed");
    }
  }
  if (hasField(input, "birthDate")) {
    const value = parseBirthDate(input.birthDate);
    if (value) {
      set.birthDate = value;
    } else {
      unset.push("birthDate");
    }
  }
  if (hasField(input, "sex")) {
    if (input.sex === null || input.sex === undefined || input.sex === "") {
      throw new AppError(400, "INVALID_SEX", `sex must be one of: ${PET_SEXES.join(", ")}`);
    }
    set.sex = parseSex(input.sex);
  }
  if (hasField(input, "weight")) {
    const value = parseWeight(input.weight);
    if (value !== undefined) {
      set.weight = value;
    } else {
      unset.push("weight");
    }
  }
  if (hasField(input, "photoFileId")) {
    const value = parseObjectId(input.photoFileId, "INVALID_PHOTO_FILE_ID", "photoFileId must be a valid id");
    if (value) {
      set.photoFileId = value;
    } else {
      unset.push("photoFileId");
    }
  }
  if (hasField(input, "microchipNumber")) {
    const value = parseMicrochip(input.microchipNumber);
    if (value) {
      set.microchipNumber = value;
    } else {
      unset.push("microchipNumber");
    }
  }
  if (hasField(input, "tags")) {
    set.tags = parseStringArray(input.tags, "INVALID_TAGS", "tags");
  }
  if (hasField(input, "notes")) {
    set.notes = parseStringArray(input.notes, "INVALID_NOTES", "notes");
  }
  if (hasField(input, "vetContact")) {
    const value = parseVetContact(input.vetContact);
    if (value) {
      set.vetContact = value;
    } else {
      unset.push("vetContact");
    }
  }

  return { set, unset };
};

export const serializePet = (pet: PetRecord): SerializedPet => {
  const result: SerializedPet = {
    id: pet._id.toString(),
    ownerId: pet.ownerId.toString(),
    name: pet.name,
    species: pet.species,
    sex: pet.sex,
    tags: pet.tags ?? [],
    notes: pet.notes ?? [],
    createdAt: pet.createdAt.toISOString(),
    updatedAt: pet.updatedAt.toISOString()
  };

  if (pet.breed) result.breed = pet.breed;
  if (pet.birthDate) result.birthDate = pet.birthDate.toISOString().slice(0, 10);
  if (pet.weight !== undefined && pet.weight !== null) result.weight = pet.weight;
  if (pet.photoFileId) result.photoFileId = pet.photoFileId.toString();
  if (pet.microchipNumber) result.microchipNumber = pet.microchipNumber;
  if (pet.vetContact) {
    const vet: SerializedVetContact = {};
    if (pet.vetContact.name) vet.name = pet.vetContact.name;
    if (pet.vetContact.phone) vet.phone = pet.vetContact.phone;
    if (pet.vetContact.email) vet.email = pet.vetContact.email;
    if (Object.keys(vet).length > 0) result.vetContact = vet;
  }

  return result;
};

const requireOwnerId = (ownerId: string): Types.ObjectId => {
  if (!isValidObjectId(ownerId)) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid access token");
  }
  return new Types.ObjectId(ownerId);
};

export const createPet = async (
  ownerId: string,
  input: CreatePetInput,
  dependencies: PetServiceDependencies = {}
): Promise<SerializedPet> => {
  const {
    createPetRecord = async (payload) => PetModel.create(payload) as unknown as PetRecord
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const normalized = normalizeCreateInput(input);

  const pet = await createPetRecord({ ownerId: ownerObjectId, ...normalized });
  return serializePet(pet);
};

export const listPets = async (
  ownerId: string,
  dependencies: PetServiceDependencies = {}
): Promise<SerializedPet[]> => {
  const {
    listPetsForOwner = async (id) =>
      PetModel.find({ ownerId: id }).sort({ createdAt: -1 }).exec() as unknown as PetRecord[]
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const pets = await listPetsForOwner(ownerObjectId);
  return pets.map(serializePet);
};

const requirePetObjectId = (petId: string): Types.ObjectId => {
  if (!isValidObjectId(petId)) {
    throw new AppError(400, "INVALID_PET_ID", "petId must be a valid id");
  }
  return new Types.ObjectId(petId);
};

const defaultFindPet: NonNullable<PetServiceDependencies["findPetByIdForOwner"]> = async (
  id,
  owner
) => PetModel.findOne({ _id: id, ownerId: owner }).exec() as unknown as PetRecord | null;

export const getPet = async (
  ownerId: string,
  petId: string,
  dependencies: PetServiceDependencies = {}
): Promise<SerializedPet> => {
  const { findPetByIdForOwner = defaultFindPet } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const petObjectId = requirePetObjectId(petId);

  const pet = await findPetByIdForOwner(petObjectId, ownerObjectId);

  if (!pet) {
    throw new AppError(404, "PET_NOT_FOUND", "Pet was not found");
  }

  return serializePet(pet);
};

export const updatePet = async (
  ownerId: string,
  petId: string,
  input: CreatePetInput,
  dependencies: PetServiceDependencies = {}
): Promise<SerializedPet> => {
  const {
    findPetByIdForOwner = defaultFindPet,
    updatePetRecord = async (id, owner, updates) => {
      const op: Record<string, unknown> = {};
      if (Object.keys(updates.set).length > 0) op.$set = updates.set;
      if (updates.unset.length > 0) {
        op.$unset = Object.fromEntries(updates.unset.map((key) => [key, ""]));
      }
      return PetModel.findOneAndUpdate({ _id: id, ownerId: owner }, op, {
        new: true
      }).exec() as unknown as PetRecord | null;
    }
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const petObjectId = requirePetObjectId(petId);
  const updates = normalizeUpdateInput(input);

  if (Object.keys(updates.set).length === 0 && updates.unset.length === 0) {
    const existing = await findPetByIdForOwner(petObjectId, ownerObjectId);
    if (!existing) {
      throw new AppError(404, "PET_NOT_FOUND", "Pet was not found");
    }
    return serializePet(existing);
  }

  const updated = await updatePetRecord(petObjectId, ownerObjectId, updates);
  if (!updated) {
    throw new AppError(404, "PET_NOT_FOUND", "Pet was not found");
  }
  return serializePet(updated);
};

export const deletePet = async (
  ownerId: string,
  petId: string,
  dependencies: PetServiceDependencies = {}
): Promise<void> => {
  const {
    findPetForDeletion = async (id, owner) =>
      PetModel.findOne({ _id: id, ownerId: owner })
        .select({ _id: 1 })
        .exec() as Promise<Pick<IPet, "_id"> | null>,
    deletePetRecord = async (id, owner) =>
      PetModel.findOneAndDelete({ _id: id, ownerId: owner }).exec() as unknown as PetRecord | null,
    deleteEventsForPet = async (id, owner) => {
      await EventModel.deleteMany({ petId: id, ownerId: owner }).exec();
    },
    deleteRemindersForPet = async (id, owner) => {
      await ReminderModel.deleteMany({ petId: id, ownerId: owner }).exec();
    },
    deleteFilesForPet = async (id, owner) => {
      await deleteAllFilesForPet(owner, id);
    },
    deleteExportsForPet = async (id, owner) => {
      await deleteAllExportsForPet(owner, id);
    }
  } = dependencies;

  const ownerObjectId = requireOwnerId(ownerId);
  const petObjectId = requirePetObjectId(petId);

  const existing = await findPetForDeletion(petObjectId, ownerObjectId);
  if (!existing) {
    throw new AppError(404, "PET_NOT_FOUND", "Pet was not found");
  }

  // Storage-backed cleanup first so a failure leaves all metadata intact for safe retry.
  await deleteFilesForPet(petObjectId, ownerObjectId);
  await deleteExportsForPet(petObjectId, ownerObjectId);

  await deleteEventsForPet(petObjectId, ownerObjectId);
  await deleteRemindersForPet(petObjectId, ownerObjectId);

  const deleted = await deletePetRecord(petObjectId, ownerObjectId);
  if (!deleted) {
    throw new AppError(404, "PET_NOT_FOUND", "Pet was not found");
  }
};
