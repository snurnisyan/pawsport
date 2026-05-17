import type { ComponentType } from "react";
import {
  LuBug,
  LuDroplet,
  LuEllipsis,
  LuFileText,
  LuHeartPulse,
  LuSyringe,
} from "react-icons/lu";
import type { IconBaseProps } from "react-icons";
import type { TPetEventSubtype, TPetEventType } from "@/store/pets";

export type TEventTypeMeta = {
  label: string;
  color: string;
  bg: string;
  bgBright: string;
  Icon: ComponentType<IconBaseProps>;
};

export type TEventSubtypeOption = {
  value: TPetEventSubtype;
  label: string;
};

export const EVENT_TYPE_ORDER = [
  "vaccine",
  "treatment",
  "visit",
  "operation",
  "lab",
  "other",
] satisfies TPetEventType[];

export const EVENT_TYPE_FILTER_ORDER = [
  "visit",
  "vaccine",
  "treatment",
  "operation",
  "lab",
  "other",
] satisfies TPetEventType[];

export const EVENT_TYPE_META: Record<TPetEventType, TEventTypeMeta> = {
  vaccine: {
    label: "Вакцинация",
    color: "#C084FC",
    bg: "rgba(192, 132, 252, 0.16)",
    bgBright: "rgb(192, 132, 252)",
    Icon: LuSyringe,
  },
  treatment: {
    label: "Обработка",
    color: "#34D399",
    bg: "rgba(52, 211, 153, 0.16)",
    bgBright: "rgb(52, 211, 153)",
    Icon: LuBug,
  },
  visit: {
    label: "Визит",
    color: "#60A5FA",
    bg: "rgba(96, 165, 250, 0.16)",
    bgBright: "rgb(96, 165, 250)",
    Icon: LuFileText,
  },
  operation: {
    label: "Операция",
    color: "#FB923C",
    bg: "rgba(251, 146, 60, 0.16)",
    bgBright: "rgb(251, 146, 60)",
    Icon: LuHeartPulse,
  },
  lab: {
    label: "Анализы и обследования",
    color: "#EF96D6",
    bg: "rgba(239, 150, 214, 0.16)",
    bgBright: "rgb(239, 150, 214)",
    Icon: LuDroplet,
  },
  other: {
    label: "Другое",
    color: "#64748B",
    bg: "rgba(100, 116, 139, 0.16)",
    bgBright: "rgb(100, 116, 139)",
    Icon: LuEllipsis,
  },
};

export const EVENT_TYPE_LABEL = Object.fromEntries(
  EVENT_TYPE_ORDER.map((type) => [type, EVENT_TYPE_META[type].label])
) as Record<TPetEventType, string>;

export const EVENT_TYPE_COLOR = Object.fromEntries(
  EVENT_TYPE_ORDER.map((type) => [type, EVENT_TYPE_META[type].color])
) as Record<TPetEventType, string>;

export const EVENT_TYPE_BG = Object.fromEntries(
  EVENT_TYPE_ORDER.map((type) => [type, EVENT_TYPE_META[type].bg])
) as Record<TPetEventType, string>;

export const EVENT_TYPE_BG_BRIGHT = Object.fromEntries(
  EVENT_TYPE_ORDER.map((type) => [type, EVENT_TYPE_META[type].bgBright])
) as Record<TPetEventType, string>;

export const EVENT_TYPE_OPTIONS = EVENT_TYPE_ORDER.map((type) => ({
  value: type,
  label: EVENT_TYPE_META[type].label,
  color: EVENT_TYPE_META[type].color,
}));

export const EVENT_TYPE_FILTER_OPTIONS = EVENT_TYPE_FILTER_ORDER.map((type) => ({
  value: type,
  label: EVENT_TYPE_META[type].label,
  color: EVENT_TYPE_META[type].color,
}));

export const EVENT_SUBTYPE_OPTIONS = {
  vaccine: [
    { value: "complex", label: "Комплексная" },
    { value: "rabies", label: "Бешенство" },
  ],
  treatment: [
    { value: "internal", label: "Внутренняя" },
    { value: "external", label: "Наружная" },
  ],
} satisfies Partial<Record<TPetEventType, TEventSubtypeOption[]>>;

export const EVENT_SUBTYPE_LABEL = Object.fromEntries(
  Object.values(EVENT_SUBTYPE_OPTIONS)
    .flat()
    .map((option) => [option.value, option.label])
) as Record<TPetEventSubtype, string>;

export const getEventSubtypeOptions = (
  type: TPetEventType | ""
): TEventSubtypeOption[] =>
  type === "vaccine" || type === "treatment" ? EVENT_SUBTYPE_OPTIONS[type] : [];

export const isEventSubtypeSupported = (type: TPetEventType | ""): boolean =>
  getEventSubtypeOptions(type).length > 0;

export const isEventSubtypeValidForType = (
  type: TPetEventType | "",
  subtype: string
): subtype is TPetEventSubtype =>
  getEventSubtypeOptions(type).some((option) => option.value === subtype);
