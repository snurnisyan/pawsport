import type { TDayEvent } from "@/components/calendar/day/DayEventCard";
import type { TMiniDayEvent } from "@/components/calendar/miniMonth/types";
import type { TPetEvent } from "@/lib/eventsApi";
import type { TPetDetail } from "@/lib/petsApi";
import type { TPetEventType } from "@/store/pets";
import { formatEventDateLong, formatTime } from "@/utils/dates";

export type TEventsByMonth = Record<number, Record<number, TDayEvent[]>>;
export type TMiniEventsByMonth = Record<number, Record<number, TMiniDayEvent[]>>;

const SEX_LABEL: Record<TPetDetail["sex"], string> = {
  male: "мальчик",
  female: "девочка",
  unknown: "пол не указан",
};

const SPECIES_LABEL: Record<string, string> = {
  dog: "собака",
  cat: "кот",
  other: "питомец",
};

const petDescription = (pet?: TPetDetail): string | undefined => {
  if (!pet) return undefined;
  const species = SPECIES_LABEL[pet.species] ?? "питомец";
  const breed = pet.breed ? `, ${pet.breed}` : "";
  return `${pet.name}, ${species}${breed} (${SEX_LABEL[pet.sex]})`;
};

export const toDayEvent = (
  event: TPetEvent,
  petsById: Map<string, TPetDetail>
): TDayEvent | undefined => {
  const time = formatTime(event.eventDate);
  if (!time) return undefined;

  const pet = petsById.get(event.petId);

  return {
    id: event.id,
    type: event.type,
    subtype: event.subtype,
    time,
    title: event.title,
    petId: event.petId,
    petName: pet?.name ?? "Питомец",
    petDescription: petDescription(pet),
    place: event.clinicName,
    comment: event.comment,
    nextDate: event.nextDate ? formatEventDateLong(event.nextDate) : undefined,
    reminder: event.reminderOffset ?? "none",
    files: event.files,
    source: event,
  };
};

export const groupEventsByMonth = (
  events: TPetEvent[],
  petsById: Map<string, TPetDetail>
): TEventsByMonth => {
  const grouped: TEventsByMonth = {};

  for (const event of events) {
    const date = new Date(event.eventDate);
    if (Number.isNaN(date.getTime())) continue;

    const viewEvent = toDayEvent(event, petsById);
    if (!viewEvent) continue;

    const month = date.getMonth();
    const day = date.getDate();
    grouped[month] ??= {};
    grouped[month][day] ??= [];
    grouped[month][day].push(viewEvent);
  }

  for (const days of Object.values(grouped)) {
    for (const dayEvents of Object.values(days)) {
      dayEvents.sort((a, b) => {
        const byTime =
          new Date(a.source.eventDate).getTime() -
          new Date(b.source.eventDate).getTime();
        if (byTime !== 0) return byTime;
        const byTitle = a.title.localeCompare(b.title, "ru");
        if (byTitle !== 0) return byTitle;
        return a.id.localeCompare(b.id);
      });
    }
  }

  return grouped;
};

export const toMiniEvents = (eventsByMonth: TEventsByMonth): TMiniEventsByMonth => {
  const result: TMiniEventsByMonth = {};
  for (const [monthKey, days] of Object.entries(eventsByMonth)) {
    const month = Number(monthKey);
    result[month] = {};
    for (const [dayKey, events] of Object.entries(days)) {
      result[month][Number(dayKey)] = events.map((event) => ({
        mark: event.type,
        title: event.title,
        petName: event.petName,
        time: event.time,
      }));
    }
  }
  return result;
};

export const toMarks = (
  eventsByMonth: TEventsByMonth
): Record<number, Record<number, TPetEventType[]>> => {
  const result: Record<number, Record<number, TPetEventType[]>> = {};
  for (const [monthKey, days] of Object.entries(eventsByMonth)) {
    const month = Number(monthKey);
    result[month] = {};
    for (const [dayKey, events] of Object.entries(days)) {
      result[month][Number(dayKey)] = Array.from(
        new Set(events.map((event) => event.type))
      );
    }
  }
  return result;
};
