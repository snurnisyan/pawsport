import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toaster } from "@/components/ui/toaster";
import {
  deleteFile,
  downloadFile,
  petEventsQueryPrefix,
  petFilesQueryPrefix,
  uploadPetFile,
  type TPetFile,
  type TPetFileListResponse,
} from "@/lib/petsApi";
import { apiErrorMessage } from "@/utils/apiErrorMessage";
import { saveBlob } from "@/utils/files";

type TUseFileActionsOptions = {
  petId?: string;
  onUploaded: () => void;
  onDeleted: () => void;
};

export function useFileActions({ petId, onUploaded, onDeleted }: TUseFileActionsOptions) {
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      if (!petId) throw new Error("Не удалось загрузить файл. Попробуйте еще раз.");
      for (const file of files) {
        await uploadPetFile(petId, file);
      }
    },
    onSuccess: async () => {
      if (petId) {
        await queryClient.invalidateQueries({ queryKey: petFilesQueryPrefix(petId) });
      }
      onUploaded();
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
        { queryKey: petId ? petFilesQueryPrefix(petId) : ["pets", "files", "missing"] },
        (previous) =>
          previous
            ? { ...previous, items: previous.items.filter((item) => item.id !== file.id) }
            : previous
      );
      if (petId) {
        await queryClient.invalidateQueries({ queryKey: petFilesQueryPrefix(petId) });
      }
      if (petId && file.eventId) {
        await queryClient.invalidateQueries({ queryKey: petEventsQueryPrefix(petId) });
      }
      onDeleted();
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

  return { uploadMutation, downloadMutation, deleteMutation };
}
