import type { components } from "@/types/api";

export type TPetExpiredEvent = components["schemas"]["ExpiredEvent"];

export type TPet = {
  id: string;
  name: string;
  species: "dog" | "cat" | "other";
  breed: string;
  sex: "male" | "female" | "unknown";
  ageLabel: string;
  weightKg: number;
  imageUrl?: string;
  chipNumber?: string;
  birthDate?: string;
  expiredEvents?: TPetExpiredEvent[];
  notes: string[];
  vet?: { name: string; phone: string; email: string };
};

export type TPetEventType = components["schemas"]["Event"]["type"];
export type TPetEventSubtype = NonNullable<components["schemas"]["Event"]["subtype"]>;
