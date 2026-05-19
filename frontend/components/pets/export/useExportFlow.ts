import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { TDateRange } from "@/components/ui/DateRangeField";
import { toaster } from "@/components/ui/toaster";
import {
  createPetExport,
  downloadExport,
  exportQueryKey,
  getExport,
  petExportMutationKey,
  type TCreatePetExportRequest,
} from "@/lib/petsApi";
import { apiErrorMessage } from "@/utils/apiErrorMessage";
import type {
  TExportEventType,
  TExportFlow,
  TExportMode,
  TPeriod,
} from "./types";
import {
  getPeriodPayload,
  isCustomPeriodValid,
  makeFilename,
  saveDownloadResult,
} from "./utils";

const EXPORT_TIMEOUT_MS = 90_000;
const SECTIONS: TCreatePetExportRequest["sections"] = ["profile", "events"];

type TUseExportFlowOptions = {
  petId?: string;
  petName: string;
  usesBackend: boolean;
  selectedEventTypes: TExportEventType[];
  hasSelectedDataType: boolean;
  period: TPeriod;
  customPeriod: TDateRange;
};

export function useExportFlow({
  petId,
  petName,
  usesBackend,
  selectedEventTypes,
  hasSelectedDataType,
  period,
  customPeriod,
}: TUseExportFlowOptions) {
  const [flow, setFlow] = useState<TExportFlow | null>(null);
  const flowIdRef = useRef(0);
  const downloadedExportIdRef = useRef<string | null>(null);

  const canSubmit =
    usesBackend &&
    Boolean(petId) &&
    hasSelectedDataType &&
    isCustomPeriodValid(period, customPeriod);

  const createMutation = useMutation({
    mutationKey: petId ? petExportMutationKey(petId) : ["pets", "missing", "export"],
    mutationFn: (mode: TExportMode) => {
      if (!petId) {
        throw new Error("Не удалось запустить экспорт. Попробуйте еще раз.");
      }

      const body: TCreatePetExportRequest = {
        sections: SECTIONS,
        eventTypes: selectedEventTypes,
        sendEmail: mode === "email",
      };
      const periodPayload = getPeriodPayload(period, customPeriod);
      if (periodPayload) body.period = periodPayload;

      return createPetExport(petId, body);
    },
  });

  const isBusy =
    createMutation.isPending ||
    Boolean(
      flow &&
        (flow.status === "creating" ||
          flow.status === "pending" ||
          flow.status === "download-starting")
    );

  const exportStatusQuery = useQuery({
    queryKey: flow?.exportId ? exportQueryKey(flow.exportId) : ["exports", "missing"],
    queryFn: () => getExport(flow?.exportId ?? ""),
    enabled: Boolean(flow?.exportId && flow.status === "pending"),
    refetchInterval: (query) =>
      query.state.data?.export.status === "pending" || !query.state.data ? 2500 : false,
    retry: false,
  });

  useEffect(() => {
    if (!flow?.exportId || flow.status !== "pending") return;

    const timeout = window.setTimeout(() => {
      setFlow((current) =>
        current?.id === flow.id && current.status === "pending"
          ? {
              ...current,
              status: "timeout",
              message: "PDF готовится дольше обычного. Попробуйте обновить статус позже.",
            }
          : current
      );
    }, EXPORT_TIMEOUT_MS);

    return () => window.clearTimeout(timeout);
  }, [flow?.exportId, flow?.id, flow?.status]);

  useEffect(() => {
    if (!flow || flow.status !== "pending") return;
    if (!exportStatusQuery.data) return;

    const petExport = exportStatusQuery.data.export;
    if (petExport.status === "pending") {
      setFlow((current) =>
        current?.id === flow.id && current.export?.updatedAt !== petExport.updatedAt
          ? { ...current, export: petExport }
          : current
      );
      return;
    }

    if (petExport.status === "failed") {
      toaster.error({
        title: "Не удалось подготовить PDF",
        description: "Не удалось подготовить PDF. Попробуйте еще раз.",
      });
      setFlow((current) =>
        current?.id === flow.id
          ? {
              ...current,
              export: petExport,
              status: "failed",
              message: "Не удалось подготовить PDF. Попробуйте еще раз.",
            }
          : current
      );
      return;
    }

    setFlow((current) =>
      current?.id === flow.id
        ? { ...current, export: petExport, status: "ready" }
        : current
    );
  }, [exportStatusQuery.data, flow]);

  useEffect(() => {
    if (!flow || flow.status !== "pending" || !exportStatusQuery.isError) return;

    const message = apiErrorMessage(
      exportStatusQuery.error,
      "Не удалось проверить статус экспорта. Попробуйте еще раз."
    );
    toaster.error({
      title: "Не удалось проверить статус экспорта",
      description: message,
    });
    setFlow((current) =>
      current?.id === flow.id ? { ...current, status: "failed", message } : current
    );
  }, [exportStatusQuery.error, exportStatusQuery.isError, flow]);

  useEffect(() => {
    if (
      !flow ||
      flow.mode !== "download" ||
      flow.status !== "ready" ||
      !flow.export?.downloadUrl ||
      downloadedExportIdRef.current === flow.export.id
    ) {
      return;
    }

    downloadedExportIdRef.current = flow.export.id;
    setFlow((current) =>
      current?.id === flow.id ? { ...current, status: "download-starting" } : current
    );

    downloadExport(flow.export.downloadUrl)
      .then((result) => {
        saveDownloadResult(result, makeFilename(petName));
        setFlow((current) =>
          current?.id === flow.id ? { ...current, status: "ready" } : current
        );
      })
      .catch((error) => {
        const message = apiErrorMessage(
          error,
          "Не удалось скачать PDF. Попробуйте еще раз."
        );
        toaster.error({
          title: "Не удалось скачать PDF",
          description: message,
        });
        setFlow((current) =>
          current?.id === flow.id ? { ...current, status: "failed", message } : current
        );
      });
  }, [flow, petName]);

  const closeFlow = () => {
    setFlow(null);
    downloadedExportIdRef.current = null;
  };

  const startExport = async (mode: TExportMode) => {
    if (!hasSelectedDataType) {
      toaster.error({
        title: "Выберите разделы",
        description: "Выберите хотя бы один тип событий",
      });
      return;
    }
    if (!canSubmit) {
      toaster.error({
        title: "Не удалось запустить экспорт",
        description:
          period === "Другой период"
            ? "Укажите корректный период для экспорта."
            : "Не удалось запустить экспорт. Попробуйте еще раз.",
      });
      return;
    }

    if (mode === "email") {
      try {
        await createMutation.mutateAsync(mode);
        toaster.create({
          type: "info",
          title: "PDF готовится",
          description: "Мы отправим PDF на email, когда файл будет готов.",
        });
      } catch (error) {
        toaster.error({
          title: "Не удалось запустить экспорт",
          description: apiErrorMessage(
            error,
            "Не удалось запустить экспорт. Попробуйте еще раз."
          ),
        });
      }
      return;
    }

    const flowId = flowIdRef.current + 1;
    flowIdRef.current = flowId;
    downloadedExportIdRef.current = null;
    setFlow({ id: flowId, mode, status: "creating" });

    try {
      const response = await createMutation.mutateAsync(mode);
      setFlow((current) =>
        current?.id === flowId
          ? {
              ...current,
              exportId: response.export.id,
              export: response.export,
              status: response.export.status,
            }
          : current
      );
    } catch (error) {
      const message = apiErrorMessage(
        error,
        "Не удалось запустить экспорт. Попробуйте еще раз."
      );
      toaster.error({
        title: "Не удалось запустить экспорт",
        description: message,
      });
      setFlow((current) =>
        current?.id === flowId ? { ...current, status: "failed", message } : current
      );
    }
  };

  const downloadReadyExport = async () => {
    if (!flow?.export?.downloadUrl) return;

    try {
      const result = await downloadExport(flow.export.downloadUrl);
      saveDownloadResult(result, makeFilename(petName));
    } catch (error) {
      toaster.error({
        title: "Не удалось скачать PDF",
        description: apiErrorMessage(error, "Не удалось скачать PDF. Попробуйте еще раз."),
      });
    }
  };

  return {
    flow,
    isBusy,
    canSubmit,
    closeFlow,
    startExport,
    downloadReadyExport,
  };
}
