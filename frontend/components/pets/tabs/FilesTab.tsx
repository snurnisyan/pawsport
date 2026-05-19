import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HStack, Heading, Stack, Text } from "@chakra-ui/react";
import { LuUpload } from "react-icons/lu";
import { FileRow } from "@/components/pets/files/FileRow";
import { FileUploadDialog } from "@/components/pets/files/FileUploadDialog";
import {
  FilesFilterBar,
  INITIAL_FILES_FILTERS,
  type TFilesFilters,
} from "@/components/pets/files/FilesFilterBar";
import { useFileActions } from "@/components/pets/files/useFileActions";
import { SecondaryButton } from "@/components/ui/Buttons";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  listPetFiles,
  petFilesQueryKey,
  type TPetFile,
  type TPetFilesQuery,
} from "@/lib/petsApi";
import { useAuthSession } from "@/lib/session";
import { apiErrorMessage } from "@/utils/apiErrorMessage";

type TFilesTabProps = {
  petId?: string;
};

export function FilesTab({ petId }: TFilesTabProps) {
  const session = useAuthSession();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filters, setFilters] = useState<TFilesFilters>(INITIAL_FILES_FILTERS);
  const [fileToDelete, setFileToDelete] = useState<TPetFile | null>(null);
  const usesBackend = Boolean(session && petId);
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

  const { uploadMutation, downloadMutation, deleteMutation } = useFileActions({
    petId,
    onUploaded: () => setDialogOpen(false),
    onDeleted: () => setFileToDelete(null),
  });

  const files = filesQuery.data?.items ?? [];
  const visibleFiles = files.filter((file) =>
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
          disabled={!petId}
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
        onSubmit={(toUpload) => uploadMutation.mutateAsync(toUpload)}
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
            const busy =
              (deleteMutation.isPending &&
                (deletingId === file.id || fileToDelete?.id === file.id)) ||
              (downloadMutation.isPending && downloadingId === file.id);
            return (
              <FileRow
                key={file.id}
                file={file}
                busy={busy}
                disabled={!usesBackend}
                onDownload={() => downloadMutation.mutate(file)}
                onDelete={() => setFileToDelete(file)}
              />
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
