import type { TPetDetail } from "@/lib/petsApi";
import type { TPet } from "@/store/pets";

const pluralRu = (value: number, forms: [string, string, string]) => {
  const mod10 = value % 10;
  const mod100 = value % 100;

  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
};

const ageLabelFromBirthDate = (birthDate?: string): string => {
  if (!birthDate) return "Возраст не указан";

  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return "Возраст не указан";

  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();

  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years > 0) {
    return `${years} ${pluralRu(years, ["год", "года", "лет"])}`;
  }

  if (months > 0) {
    return `${months} ${pluralRu(months, ["месяц", "месяца", "месяцев"])}`;
  }

  return "Меньше месяца";
};

export const toPetViewModel = (pet: TPetDetail): TPet => ({
  id: pet.id,
  name: pet.name,
  species: pet.species === "dog" || pet.species === "cat" ? pet.species : "other",
  breed: pet.breed || "—",
  sex: pet.sex,
  ageLabel: ageLabelFromBirthDate(pet.birthDate),
  weightKg: pet.weight ?? 0,
  imageUrl: pet.photoUrl,
  chipNumber: pet.microchipNumber,
  birthDate: pet.birthDate,
  notes: pet.notes,
  vet: pet.vetContact
    ? {
        name: pet.vetContact.name ?? "",
        phone: pet.vetContact.phone ?? "",
        email: pet.vetContact.email ?? "",
      }
    : undefined,
});
