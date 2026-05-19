import { Box, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { LuCheck, LuDownload, LuTriangleAlert } from "react-icons/lu";
import { GhostButton, SecondaryButton } from "@/components/ui/Buttons";
import { DialogShell } from "@/components/ui/DialogShell";
import type { TExportFlow } from "./types";

type TExportProgressDialogProps = {
  flow: TExportFlow | null;
  onOpenChange: (open: boolean) => void;
  onDownload: () => void;
};

export function ExportProgressDialog({
  flow,
  onOpenChange,
  onDownload,
}: TExportProgressDialogProps) {
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
