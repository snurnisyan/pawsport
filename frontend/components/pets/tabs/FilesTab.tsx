import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  HStack,
  Heading,
  IconButton,
  Stack,
  Text,
} from "@chakra-ui/react";
import {
  LuDownload,
  LuFileText,
  LuFileImage,
  LuFile,
  LuTrash,
  LuUpload,
} from "react-icons/lu";
import { FileUploadDialog } from "@/components/pets/files/FileUploadDialog";
import {
  FilesFilterBar,
  INITIAL_FILES_FILTERS,
  type TFilesFilters,
} from "@/components/pets/files/FilesFilterBar";
import { SecondaryButton } from "@/components/ui/Buttons";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toaster } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api";
import {
  deleteFile,
  downloadFile,
  listPetFiles,
  petEventsQueryKey,
  petFilesQueryKey,
  uploadPetFile,
  type TPetFile,
  type TPetFileListResponse,
  type TPetFilesQuery,
} from "@/lib/petsApi";
import { useAuthSession } from "@/lib/session";

type TFileKind = "pdf" | "image" | "file";

type TDemoFile = {
  id: string;
  originalName: string;
  mimeType: TPetFile["mimeType"];
  sizeBytes: number;
  uploadedAt: string;
  eventId?: string;
};

type TFilesTabProps = {
  petId?: string;
};

const DEMO_FILES: TDemoFile[] = [
  {
    id: "demo-blood-test",
    originalName: "Общий анализ крови",
    mimeType: "application/pdf",
    sizeBytes: 1_258_291,
    uploadedAt: "2025-10-24T10:00:00.000Z",
  },
  {
    id: "demo-xray",
    originalName: "Рентген правой задней лапы",
    mimeType: "image/jpeg",
    sizeBytes: 4_718_592,
    uploadedAt: "2025-06-12T10:00:00.000Z",
    eventId: "demo-event",
  },
];

const TYPE_META: Record<TFileKind, { icon: ReactNode; bg: string; color: string }> = {
  pdf: {
    icon: <LuFileText />,
    bg: "rgba(239, 68, 68, 0.15)",
    color: "#FCA5A5",
  },
  image: {
    icon: <LuFileImage />,
    bg: "rgba(59, 130, 246, 0.15)",
    color: "#93C5FD",
  },
  file: {
    icon: <LuFile />,
    bg: "rgba(16, 185, 129, 0.15)",
    color: "#6EE7B7",
  },
};

const getKind = (mimeType: string): TFileKind => {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  return "file";
};

const getTypeLabel = (mimeType: string): string => {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === "image/png") return "PNG";
  if (mimeType === "image/jpeg") return "JPG";
  return "FILE";
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (date: string): string =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));

const apiErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ApiError) return error.message;
  return fallback;
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

export function FilesTab({ petId }: TFilesTabProps) {
  const session = useAuthSession();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filters, setFilters] = useState<TFilesFilters>(INITIAL_FILES_FILTERS);
  const [fileToDelete, setFileToDelete] = useState<TPetFile | null>(null);
  const usesBackend = Boolean(session?.accessToken && petId);
  const dateFilters = useMemo<TPetFilesQuery>(
    () => ({
      from: filters.dateRange.from || undefined,
      to: filters.dateRange.to || undefined,
    }),
    [filters.dateRange.from, filters.dateRange.to]
  );
  const filesQuery = useQuery({
    queryKey: petId ? petFilesQueryKey(petId, dateFilters) : ["pets", "files", "missing"],
    queryFn: () => listPetFiles(petId ?? "", dateFilters),
    enabled: usesBackend,
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      if (!petId) throw new Error("Не удалось загрузить файл. Попробуйте еще раз.");
      for (const file of files) {
        await uploadPetFile(petId, file);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pets", petId, "files"] });
      setDialogOpen(false);
    },
    onError: (error) => {
      toaster.error({
        title: "Не удалось загрузить файл",
        description: apiErrorMessage(
          error,
          "Не удалось загрузить файл. Проверьте формат и попробуйте еще раз."
        ),
      });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async (file: TPetFile) => {
      const result = await downloadFile(file.id);
      return { file, ...result };
    },
    onSuccess: ({ blob, filename, file }) => {
      saveBlob(blob, filename ?? file.originalName);
    },
    onError: (error) => {
      toaster.error({
        title: "Не удалось скачать файл",
        description: apiErrorMessage(
          error,
          "Не удалось скачать файл. Попробуйте еще раз."
        ),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (file: TPetFile) => deleteFile(file.id).then(() => file),
    onSuccess: async (file) => {
      queryClient.setQueriesData<TPetFileListResponse>(
        { queryKey: ["pets", petId, "files"] },
        (previous) =>
          previous
            ? { ...previous, items: previous.items.filter((item) => item.id !== file.id) }
            : previous
      );
      await queryClient.invalidateQueries({ queryKey: ["pets", petId, "files"] });
      if (petId && file.eventId) {
        await queryClient.invalidateQueries({ queryKey: petEventsQueryKey(petId) });
      }
      setFileToDelete(null);
    },
    onError: (error) => {
      toaster.error({
        title: "Не удалось удалить файл",
        description: apiErrorMessage(
          error,
          "Не удалось удалить файл. Попробуйте еще раз."
        ),
      });
    },
  });

  const backendFiles = filesQuery.data?.items ?? [];
  const sourceFiles = usesBackend ? backendFiles : DEMO_FILES;
  const visibleFiles = sourceFiles.filter((file) =>
    file.originalName.toLowerCase().includes(filters.search.trim().toLowerCase())
  );
  const deletingId = deleteMutation.variables?.id;
  const downloadingId = downloadMutation.variables?.id;

  return (
    <Stack gap="24px">
      <HStack justify="space-between" flexWrap="wrap" gap="12px">
        <Stack gap="4px">
          <Heading size="lg">Файлы</Heading>
          <Text color="fg.muted" fontSize="14px">
            Управление и доступ ко всем файлам питомца
          </Text>
        </Stack>
        <SecondaryButton
          h="44px"
          px="20px"
          onClick={() => setDialogOpen(true)}
          disabled={usesBackend && !petId}
        >
          <HStack gap="8px">
            <LuUpload />
            <Text>Загрузить файл</Text>
          </HStack>
        </SecondaryButton>
      </HStack>

      <FileUploadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={(files) => uploadMutation.mutateAsync(files)}
        isPending={uploadMutation.isPending}
      />

      <ConfirmDialog
        open={Boolean(fileToDelete)}
        onOpenChange={(open) => {
          if (!open) setFileToDelete(null);
        }}
        title="Удалить файл?"
        description={
          fileToDelete?.eventId
            ? "Файл будет удален из карточки питомца и из связанного события."
            : "Файл будет удален из карточки питомца."
        }
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (fileToDelete) deleteMutation.mutate(fileToDelete);
        }}
      />

      <FilesFilterBar value={filters} onChange={setFilters} />

      {usesBackend && filesQuery.isLoading ? (
        <Text color="fg.muted">Загружаем файлы...</Text>
      ) : usesBackend && filesQuery.isError ? (
        <Stack gap="6px">
          <Text fontWeight={700} color="red.200">
            Не удалось загрузить файлы
          </Text>
          <Text color="fg.muted" fontSize="14px">
            {apiErrorMessage(filesQuery.error, "Попробуйте обновить страницу.")}
          </Text>
        </Stack>
      ) : visibleFiles.length === 0 ? (
        <Text color="fg.muted">Файлы не загружены</Text>
      ) : (
        <Stack gap="8px">
          {visibleFiles.map((file) => {
            const meta = TYPE_META[getKind(file.mimeType)];
            const rowBusy =
              (deleteMutation.isPending && (deletingId === file.id || fileToDelete?.id === file.id)) ||
              (downloadMutation.isPending && downloadingId === file.id);
            return (
              <HStack
                key={file.id}
                justify="space-between"
                bg="bg.surface"
                borderWidth="1px"
                borderColor="border.subtle"
                rounded="card"
                p="16px"
                gap="12px"
                minH="74px"
              >
                <HStack gap="12px" flex={1} minW={0}>
                  <Box
                    w="40px"
                    h="40px"
                    rounded="lg"
                    bg={meta.bg}
                    color={meta.color}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    flexShrink={0}
                  >
                    {meta.icon}
                  </Box>
                  <Stack gap="2px" minW={0}>
                    <Text fontWeight={500} truncate>
                      {file.originalName}
                    </Text>
                    <Text fontSize="12px" color="fg.muted">
                      {getTypeLabel(file.mimeType)} · {formatSize(file.sizeBytes)} · {formatDate(file.uploadedAt)}
                    </Text>
                    <Text fontSize="12px" color="fg.muted">
                      {file.eventId ? "Связан с событием" : "Без события"}
                    </Text>
                  </Stack>
                </HStack>
                <HStack gap="4px" flexShrink={0}>
                  <IconButton
                    aria-label="Скачать"
                    size="sm"
                    variant="ghost"
                    color="fg.muted"
                    disabled={rowBusy || !usesBackend}
                    onClick={() => downloadMutation.mutate(file as TPetFile)}
                    _hover={{ color: "fg.default", bg: "secondary.700" }}
                  >
                    <LuDownload />
                  </IconButton>
                  <IconButton
                    aria-label="Удалить"
                    size="sm"
                    variant="ghost"
                    color="fg.muted"
                    disabled={rowBusy || !usesBackend}
                    onClick={() => setFileToDelete(file as TPetFile)}
                    _hover={{ color: "status.danger", bg: "secondary.700" }}
                  >
                    <LuTrash />
                  </IconButton>
                </HStack>
              </HStack>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
