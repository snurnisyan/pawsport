import {
  Box,
  Checkbox,
  HStack,
  Heading,
  Icon,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  LuCheck,
  LuDownload,
  LuMail,
  LuTriangleAlert,
} from "react-icons/lu";
import { DateRangeField, type TDateRange } from "@/components/ui/DateRangeField";
import { DialogShell } from "@/components/ui/DialogShell";
import { GhostButton, PrimaryButton, SecondaryButton } from "@/components/ui/Buttons";
import { Pressable } from "@/components/ui/Pressable";
import { toaster } from "@/components/ui/toaster";
import { EVENT_TYPE_META, EVENT_TYPE_OPTIONS } from "@/lib/eventTypes";
import { ApiError } from "@/lib/api";
import {
  createPetExport,
  downloadExport,
  exportQueryKey,
  getExport,
  petExportMutationKey,
  type TCreatePetExportRequest,
  type TPetExport,
} from "@/lib/petsApi";

const PERIODS = ["Все время", "Год", "Полгода", "3 месяца", "Другой период"] as const;
const EXPORT_TIMEOUT_MS = 90_000;

type TPeriod = (typeof PERIODS)[number];
type TExportMode = "download" | "email";
type TExportFlowStatus = "creating" | "pending" | "ready" | "failed" | "timeout" | "download-starting";
type TExportSection = TPetExport["sections"][number];
type TExportEventType = NonNullable<TCreatePetExportRequest["eventTypes"]>[number];

type TDataType = {
  id: TExportEventType;
  label: string;
  icon: ReactNode;
  color: string;
};

type TExportFlow = {
  id: number;
  mode: TExportMode;
  status: TExportFlowStatus;
  exportId?: string;
  export?: TPetExport;
  message?: string;
};

type TExportTabProps = {
  petId?: string;
  petName: string;
  usesBackend: boolean;
};

const DATA_TYPES: TDataType[] = EVENT_TYPE_OPTIONS.map((option) => {
  const meta = EVENT_TYPE_META[option.value];
  const EventIcon = meta.Icon;
  return {
    id: option.value,
    label: option.label,
    icon: <EventIcon />,
    color: meta.color,
  };
});

const INITIAL_SELECTED = DATA_TYPES.reduce<Record<TExportEventType, boolean>>((acc, item) => {
  acc[item.id] = true;
  return acc;
}, {} as Record<TExportEventType, boolean>);

const apiErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ApiError) return error.message;
  return fallback;
};

const pad = (value: number): string => String(value).padStart(2, "0");

const toDateOnly = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const subtractMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  result.setMonth(result.getMonth() - months);
  return result;
};

const getPeriodPayload = (
  period: TPeriod,
  customPeriod: TDateRange
): TCreatePetExportRequest["period"] | undefined => {
  if (period === "Все время") return undefined;
  if (period === "Другой период") {
    return customPeriod.from && customPeriod.to
      ? { from: customPeriod.from, to: customPeriod.to }
      : undefined;
  }

  const today = new Date();
  const to = toDateOnly(today);
  const from =
    period === "Год"
      ? toDateOnly(new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()))
      : period === "Полгода"
        ? toDateOnly(subtractMonths(today, 6))
        : toDateOnly(subtractMonths(today, 3));

  return { from, to };
};

const isCustomPeriodValid = (period: TPeriod, customPeriod: TDateRange): boolean => {
  if (period !== "Другой период") return true;
  return Boolean(
    customPeriod.from &&
      customPeriod.to &&
      customPeriod.from <= customPeriod.to
  );
};

const getSelectedEventTypes = (selected: Record<TExportEventType, boolean>): TExportEventType[] =>
  DATA_TYPES.filter((item) => selected[item.id]).map((item) => item.id);

const makeFilename = (petName: string): string => {
  const normalized = petName
    .trim()
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return `pawsport-${normalized || "pet"}-export.pdf`;
};

const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const saveUrl = (url: string, filename: string) => {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
};

const saveDownloadResult = (
  result: Awaited<ReturnType<typeof downloadExport>>,
  fallbackFilename: string
) => {
  if ("blob" in result) {
    saveBlob(result.blob, result.filename ?? fallbackFilename);
    return;
  }

  saveUrl(result.downloadUrl, fallbackFilename);
};

export function ExportTab({ petId, petName, usesBackend }: TExportTabProps) {
  const [period, setPeriod] = useState<TPeriod>("Полгода");
  const [customPeriod, setCustomPeriod] = useState<TDateRange>({ from: "", to: "" });
  const [selected, setSelected] = useState<Record<TExportEventType, boolean>>(INITIAL_SELECTED);
  const [flow, setFlow] = useState<TExportFlow | null>(null);
  const flowIdRef = useRef(0);
  const downloadedExportIdRef = useRef<string | null>(null);

  const selectedEventTypes = useMemo(() => getSelectedEventTypes(selected), [selected]);
  const hasSelectedDataType = useMemo(
    () => Object.values(selected).some(Boolean),
    [selected]
  );
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
        sections: ["profile", "events"] as TExportSection[],
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

    toaster.error({
      title: "Не удалось проверить статус экспорта",
      description: apiErrorMessage(
        exportStatusQuery.error,
        "Не удалось проверить статус экспорта. Попробуйте еще раз."
      ),
    });
    setFlow((current) =>
      current?.id === flow.id
        ? {
            ...current,
            status: "failed",
            message: apiErrorMessage(
              exportStatusQuery.error,
              "Не удалось проверить статус экспорта. Попробуйте еще раз."
            ),
          }
        : current
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
        toaster.error({
          title: "Не удалось скачать PDF",
          description: apiErrorMessage(error, "Не удалось скачать PDF. Попробуйте еще раз."),
        });
        setFlow((current) =>
          current?.id === flow.id
            ? {
                ...current,
                status: "failed",
                message: apiErrorMessage(error, "Не удалось скачать PDF. Попробуйте еще раз."),
              }
            : current
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
      toaster.error({
        title: "Не удалось запустить экспорт",
        description: apiErrorMessage(
          error,
          "Не удалось запустить экспорт. Попробуйте еще раз."
        ),
      });
      setFlow((current) =>
        current?.id === flowId
          ? {
              ...current,
              status: "failed",
              message: apiErrorMessage(
                error,
                "Не удалось запустить экспорт. Попробуйте еще раз."
              ),
            }
          : current
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

  return (
    <>
      <Box
        bg="bg.surface"
        borderWidth="1px"
        borderColor="border.subtle"
        rounded="card"
        p={["20px", null, "28px"]}
      >
        <Stack gap="24px">
          <Stack gap="4px">
            <Heading size="lg">Экспорт данных о питомце</Heading>
            <Text color="fg.muted" fontSize="14px">
              Выберите период и тип данных для выгрузки
            </Text>
          </Stack>

          <Stack gap="12px">
            <Text
              fontSize="12px"
              fontWeight={700}
              letterSpacing="0.12em"
              textTransform="uppercase"
              color="fg.muted"
            >
              Период
            </Text>
            <HStack gap="8px" flexWrap="wrap">
              {PERIODS.map((p) => (
                <Pressable
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  px="16px"
                  py="8px"
                  rounded="full"
                  fontSize="14px"
                  fontWeight={500}
                  borderWidth="1px"
                  cursor="pointer"
                  transition="all 0.15s"
                  bg={period === p ? "secondary.500" : "transparent"}
                  borderColor={period === p ? "border.default" : "border.subtle"}
                  color={period === p ? "fg.default" : "fg.muted"}
                  _hover={{ borderColor: "border.default" }}
                >
                  {p}
                </Pressable>
              ))}
            </HStack>
            {period === "Другой период" && (
              <Box maxW="360px">
                <DateRangeField
                  triggerLabel="Выберите даты"
                  value={customPeriod}
                  onChange={setCustomPeriod}
                />
              </Box>
            )}
          </Stack>

          <Stack gap="12px">
            <Text
              fontSize="12px"
              fontWeight={700}
              letterSpacing="0.12em"
              textTransform="uppercase"
              color="fg.muted"
            >
              Типы событий
            </Text>
            <Stack gap="8px">
              {DATA_TYPES.map((t) => {
                const checked = Boolean(selected[t.id]);
                return (
                  <HStack
                    key={t.id}
                    bg="secondary.700"
                    borderWidth="1px"
                    borderColor="border.subtle"
                    rounded="card"
                    px="16px"
                    py="12px"
                    justify="space-between"
                    cursor="pointer"
                    onClick={() =>
                      setSelected((s) => ({ ...s, [t.id]: !checked }))
                    }
                  >
                    <HStack gap="12px">
                      <Box color={t.color}>
                        <Icon boxSize="16px">{t.icon}</Icon>
                      </Box>
                      <Text fontSize="14px" fontWeight={500}>
                        {t.label}
                      </Text>
                    </HStack>
                    <Checkbox.Root
                      checked={checked}
                      colorPalette="blue"
                      pointerEvents="none"
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control />
                    </Checkbox.Root>
                  </HStack>
                );
              })}
            </Stack>
            {!hasSelectedDataType && (
              <Text color="red.200" fontSize="13px">
                Выберите хотя бы один тип событий
              </Text>
            )}
          </Stack>

          <SimpleGrid columns={[1, 2]} gap="12px" pt="8px">
            <PrimaryButton
              disabled={!canSubmit || isBusy}
              onClick={() => void startExport("download")}
            >
              <HStack gap="8px">
                <LuDownload />
                <Text>Сохранить PDF</Text>
              </HStack>
            </PrimaryButton>
            <SecondaryButton
              disabled={!canSubmit || isBusy}
              onClick={() => void startExport("email")}
            >
              <HStack gap="8px">
                <LuMail />
                <Text>Отправить по почте</Text>
              </HStack>
            </SecondaryButton>
          </SimpleGrid>
        </Stack>
      </Box>

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

function ExportProgressDialog({
  flow,
  onOpenChange,
  onDownload,
}: {
  flow: TExportFlow | null;
  onOpenChange: (open: boolean) => void;
  onDownload: () => void;
}) {
  const open = Boolean(flow);
  const status = flow?.status;
  const title =
    status === "ready"
      ? flow?.mode === "email"
        ? "PDF готов и будет отправлен на email"
        : "PDF готов"
      : status === "failed"
        ? "Не удалось подготовить PDF"
        : status === "timeout"
          ? "PDF готовится дольше обычного"
          : "Готовим PDF...";
  const detail =
    status === "ready"
      ? flow?.mode === "email"
        ? "PDF готов и будет отправлен на email"
        : "Начинаем скачивание..."
      : status === "failed"
        ? flow?.message ?? "Не удалось подготовить PDF. Попробуйте еще раз."
        : status === "timeout"
          ? flow?.message ?? "PDF готовится дольше обычного. Попробуйте обновить статус позже."
          : flow?.mode === "email"
            ? "Это может занять до минуты. Мы отправим PDF на email, когда файл будет готов."
            : "Это может занять до минуты. Файл скачается автоматически, когда будет готов.";
  const isWorking =
    status === "creating" || status === "pending" || status === "download-starting";
  const isError = status === "failed" || status === "timeout";

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      subtitle={flow?.mode === "email" ? "Отправка по почте" : "Сохранение PDF"}
      footer={
        <HStack gap="12px" w="full">
          <GhostButton flex={1} onClick={() => onOpenChange(false)}>
            Закрыть
          </GhostButton>
          {flow?.mode === "email" && status === "ready" && flow.export?.downloadUrl && (
            <SecondaryButton flex={1} onClick={onDownload}>
              <HStack gap="8px">
                <LuDownload />
                <Text>Скачать PDF</Text>
              </HStack>
            </SecondaryButton>
          )}
        </HStack>
      }
    >
      <Stack gap="16px" align="center" textAlign="center" py="12px">
        <Box
          w="56px"
          h="56px"
          rounded="full"
          display="grid"
          placeItems="center"
          bg={isError ? "rgba(248, 113, 113, 0.14)" : "rgba(96, 165, 250, 0.14)"}
          color={isError ? "red.200" : status === "ready" ? "#6EE7B7" : "primary.300"}
        >
          {isWorking ? (
            <Spinner color="primary.300" />
          ) : isError ? (
            <LuTriangleAlert size={24} />
          ) : (
            <LuCheck size={24} />
          )}
        </Box>
        <Stack gap="6px">
          <Text fontWeight={700}>{title}</Text>
          <Text color="fg.muted" fontSize="14px">
            {detail}
          </Text>
        </Stack>
      </Stack>
    </DialogShell>
  );
}
