import type { TPetEventType } from "@/store/pets";

export type TDayMark = TPetEventType;

export type TMiniDayEvent = {
  mark: TDayMark;
  title: string;
  petName: string;
  time: string;
};
