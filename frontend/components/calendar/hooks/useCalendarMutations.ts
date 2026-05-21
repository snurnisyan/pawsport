import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TDayEvent } from "@/components/calendar/day/DayEventCard";
import type { TEventFormData } from "@/components/pets/events/EventForm";
import {
  buildCreatePayload,
  buildUpdatePayload,
} from "@/components/pets/events/eventTransforms";
import { toaster } from "@/components/ui/toaster";
import {
  calendarQueryKey,
  type TCalendarQuery,
} from "@/lib/calendarApi";
import {
  createPetEvent,
  deleteEvent,
  eventQueryKey,
  petEventsQueryPrefix,
  updateEvent,
} from "@/lib/eventsApi";
import {
  deleteFile,
  petFilesQueryPrefix,
  petsQueryKey,
  type TPetFileListResponse,
} from "@/lib/petsApi";
import { apiErrorMessage } from "@/utils/apiErrorMessage";

export function useCalendarMutations(calendarQuery: TCalendarQuery) {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: TEventFormData) => {
      if (!data.petId) throw new Error("Выберите питомца для события.");
      const payload = buildCreatePayload(data);
      return createPetEvent(data.petId, { ...payload, fileIds: [] }, data.files);
    },
    onSuccess: async (response, data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: calendarQueryKey(calendarQuery) }),
        queryClient.invalidateQueries({ queryKey: petEventsQueryPrefix(data.petId) }),
        queryClient.invalidateQueries({ queryKey: petsQueryKey }),
        data.files.length > 0
          ? queryClient.invalidateQueries({ queryKey: petFilesQueryPrefix(data.petId) })
          : Promise.resolve(),
      ]);
      return response;
    },
    onError: (error) => {
      toaster.error({
        title: "Не удалось добавить событие",
        description: apiErrorMessage(error, "Попробуйте еще раз."),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      event,
      data,
      keptExistingFileIds,
    }: {
      event: TDayEvent;
      data: TEventFormData;
      keptExistingFileIds: string[];
    }) => {
      const originalIds = (event.source.files ?? []).map((file) => file.fileId);
      const removedIds = originalIds.filter((id) => !keptExistingFileIds.includes(id));
      const payload = buildUpdatePayload(data);
      const result = await updateEvent(event.id, payload, {
        petId: event.petId,
        files: data.files,
        existingFileIds: keptExistingFileIds,
      });

      if (removedIds.length > 0) {
        await Promise.allSettled(removedIds.map((id) => deleteFile(id)));
      }

      return {
        event,
        data,
        result,
        filesChanged: data.files.length > 0 || removedIds.length > 0,
      };
    },
    onSuccess: async ({ event, data, filesChanged }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: calendarQueryKey(calendarQuery) }),
        queryClient.invalidateQueries({ queryKey: petEventsQueryPrefix(event.petId) }),
        queryClient.invalidateQueries({ queryKey: eventQueryKey(event.id) }),
        queryClient.invalidateQueries({ queryKey: petsQueryKey }),
        filesChanged
          ? queryClient.invalidateQueries({ queryKey: petFilesQueryPrefix(event.petId) })
          : Promise.resolve(),
      ]);
      return data;
    },
    onError: (error) => {
      toaster.error({
        title: "Не удалось обновить событие",
        description: apiErrorMessage(error, "Попробуйте еще раз."),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (event: TDayEvent) => deleteEvent(event.id).then(() => event),
    onSuccess: async (event) => {
      const deletedFileIds = new Set((event.source.files ?? []).map((file) => file.fileId));
      if (deletedFileIds.size > 0) {
        queryClient.setQueriesData<TPetFileListResponse>(
          { queryKey: petFilesQueryPrefix(event.petId) },
          (previous) =>
            previous
              ? {
                  ...previous,
                  items: previous.items.filter((file) => !deletedFileIds.has(file.id)),
                }
              : previous
        );
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: calendarQueryKey(calendarQuery) }),
        queryClient.invalidateQueries({ queryKey: petEventsQueryPrefix(event.petId) }),
        queryClient.invalidateQueries({ queryKey: petFilesQueryPrefix(event.petId) }),
        queryClient.invalidateQueries({ queryKey: eventQueryKey(event.id) }),
        queryClient.invalidateQueries({ queryKey: petsQueryKey }),
      ]);
      toaster.create({ type: "success", title: "Событие удалено" });
    },
    onError: (error) => {
      toaster.error({
        title: "Не удалось удалить событие",
        description: apiErrorMessage(error, "Попробуйте еще раз."),
      });
    },
  });

  return { createMutation, updateMutation, deleteMutation };
}
