import type {
  TCreatePetExportRequest,
  TPetExport,
} from "@/lib/petsApi";

export const PERIODS = [
  "Все время",
  "Год",
  "Полгода",
  "3 месяца",
  "Другой период",
] as const;

export type TPeriod = (typeof PERIODS)[number];
export type TExportMode = "download" | "email";
export type TExportFlowStatus =
  | "creating"
  | "pending"
  | "ready"
  | "failed"
  | "timeout"
  | "download-starting";
export type TExportEventType = NonNullable<
  TCreatePetExportRequest["eventTypes"]
>[number];

export type TExportFlow = {
  id: number;
  mode: TExportMode;
  status: TExportFlowStatus;
  exportId?: string;
  export?: TPetExport;
  message?: string;
};
