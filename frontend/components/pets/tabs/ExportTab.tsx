import { useMemo, useState } from "react";
import { ExportProgressDialog } from "@/components/pets/export/ExportProgressDialog";
import { ExportSettings } from "@/components/pets/export/ExportSettings";
import { useExportFlow } from "@/components/pets/export/useExportFlow";
import {
  INITIAL_SELECTED,
  getSelectedEventTypes,
} from "@/components/pets/export/utils";
import type {
  TExportEventType,
  TPeriod,
} from "@/components/pets/export/types";
import type { TDateRange } from "@/components/ui/DateRangeField";

type TExportTabProps = {
  petId?: string;
  petName: string;
  usesBackend: boolean;
};

export function ExportTab({ petId, petName, usesBackend }: TExportTabProps) {
  const [period, setPeriod] = useState<TPeriod>("Полгода");
  const [customPeriod, setCustomPeriod] = useState<TDateRange>({ from: "", to: "" });
  const [selected, setSelected] = useState<Record<TExportEventType, boolean>>(INITIAL_SELECTED);

  const selectedEventTypes = useMemo(() => getSelectedEventTypes(selected), [selected]);
  const hasSelectedDataType = useMemo(
    () => Object.values(selected).some(Boolean),
    [selected]
  );

  const { flow, isBusy, canSubmit, closeFlow, startExport, downloadReadyExport } =
    useExportFlow({
      petId,
      petName,
      usesBackend,
      selectedEventTypes,
      hasSelectedDataType,
      period,
      customPeriod,
    });

  return (
    <>
      <ExportSettings
        period={period}
        customPeriod={customPeriod}
        selected={selected}
        hasSelectedDataType={hasSelectedDataType}
        canSubmit={canSubmit}
        isBusy={isBusy}
        onPeriodChange={setPeriod}
        onCustomPeriodChange={setCustomPeriod}
        onSelectedChange={setSelected}
        onStart={(mode) => void startExport(mode)}
      />
      <ExportProgressDialog
        flow={flow}
        onOpenChange={(open) => {
          if (!open) closeFlow();
        }}
        onDownload={downloadReadyExport}
      />
    </>
  );
}
