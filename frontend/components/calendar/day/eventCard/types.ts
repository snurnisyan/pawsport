import type {
  TExistingEventFile,
  TReminderValue,
} from "@/components/pets/events/EventForm";
import type { TPetEvent } from "@/lib/eventsApi";
import type { TPetEventSubtype, TPetEventType } from "@/store/pets";

export type TDayEventType = TPetEventType;

export type TDayEvent = {
  id: string;
  type: TDayEventType;
  subtype?: TPetEventSubtype;
  time: string;
  title: string;
  petId: string;
  petName: string;
  petDescription?: string;
  place?: string;
  comment?: string;
  nextDate?: string;
  reminder?: TReminderValue;
  files?: TExistingEventFile[];
  source: TPetEvent;
};
