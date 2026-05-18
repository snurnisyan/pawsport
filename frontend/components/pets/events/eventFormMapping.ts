import { isEventSubtypeSupported } from "@/lib/eventTypes";
import type { TCreateEventRequest, TPetEvent } from "@/lib/eventsApi";
import type { TPetEventType } from "@/store/pets";
import type { TEventFormData, TReminderValue } from "./EventForm";

export const splitDateTime = (iso: string): { date: string; time: string } => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { date, time };
};

export const toIsoDateTime = (date: string, time?: string): string => {
  const hhmm = time && time.length > 0 ? time : "00:00";
  return new Date(`${date}T${hhmm}:00`).toISOString();
};

export const todayIsoDate = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export type TEventPayloadBase = Omit<TCreateEventRequest, "fileIds">;

export const fromEvent = (event: TPetEvent): TEventFormData => {
  const { date, time } = splitDateTime(event.eventDate);
  return {
    title: event.title,
    type: event.type,
    subtype: event.subtype ?? "",
    petId: event.petId,
    date,
    time,
    nextDate: event.nextDate ? splitDateTime(event.nextDate).date : "",
    reminder: (event.reminderOffset ?? "none") as TReminderValue,
    clinic: event.clinicName ?? "",
    comment: event.comment ?? "",
    files: [],
  };
};

export const buildPayload = (data: TEventFormData): TEventPayloadBase => ({
  type: data.type as TPetEventType,
  subtype: isEventSubtypeSupported(data.type) ? data.subtype || undefined : undefined,
  title: data.title.trim(),
  eventDate: toIsoDateTime(data.date, data.time),
  nextDate: data.nextDate ? toIsoDateTime(data.nextDate) : undefined,
  clinicName: data.clinic.trim() || undefined,
  comment: data.comment.trim() || undefined,
  reminderOffset: data.reminder === "none" ? undefined : data.reminder,
});
