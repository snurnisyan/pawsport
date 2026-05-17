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
import type { TPetEventType } from "@/store/pets";

type TEventTypeTone = "info" | "purple" | "teal" | "warning";

export type TEventTypeMeta = {
  label: string;
  color: string;
  bg: string;
  tone: TEventTypeTone;
  Icon: ComponentType<IconBaseProps>;
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
    tone: "purple",
    Icon: LuSyringe,
  },
  treatment: {
    label: "Обработка",
    color: "#34D399",
    bg: "rgba(52, 211, 153, 0.16)",
    tone: "teal",
    Icon: LuBug,
  },
  visit: {
    label: "Визит",
    color: "#60A5FA",
    bg: "rgba(96, 165, 250, 0.16)",
    tone: "info",
    Icon: LuFileText,
  },
  operation: {
    label: "Операция",
    color: "#FB923C",
    bg: "rgba(251, 146, 60, 0.16)",
    tone: "warning",
    Icon: LuHeartPulse,
  },
  lab: {
    label: "Анализы и обследования",
    color: "#EF96D6",
    bg: "rgba(239, 150, 214, 0.16)",
    tone: "info",
    Icon: LuDroplet,
  },
  other: {
    label: "Другое",
    color: "#64748B",
    bg: "rgba(100, 116, 139, 0.16)",
    tone: "info",
    Icon: LuEllipsis,
  },
};

export const EVENT_TYPE_LABEL = Object.fromEntries(
  EVENT_TYPE_ORDER.map((type) => [type, EVENT_TYPE_META[type].label])
) as Record<TPetEventType, string>;

export const EVENT_TYPE_COLOR = Object.fromEntries(
  EVENT_TYPE_ORDER.map((type) => [type, EVENT_TYPE_META[type].color])
) as Record<TPetEventType, string>;

export const EVENT_TYPE_TONE = Object.fromEntries(
  EVENT_TYPE_ORDER.map((type) => [type, EVENT_TYPE_META[type].tone])
) as Record<TPetEventType, TEventTypeTone>;

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
