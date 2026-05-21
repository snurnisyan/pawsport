import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DialogActions } from "@/components/ui/DialogActions";
import { DialogShell } from "@/components/ui/DialogShell";
import { toaster } from "@/components/ui/toaster";
import {
  createPetEvent,
  eventQueryKey,
  petEventsQueryPrefix,
  updateEvent,
  type TPetEvent,
  type TUpdateEventRequest,
} from "@/lib/eventsApi";
import { deleteFile, petFilesQueryPrefix, petsQueryKey } from "@/lib/petsApi";
import { isEventSubtypeSupported } from "@/lib/eventTypes";
import { apiErrorMessage } from "@/utils/apiErrorMessage";
import {
  EventForm,
  INITIAL_EVENT,
  type TEventFormData,
  type TExistingEventFile,
} from "./EventForm";
import { todayIsoDate } from "@/utils/dates";
import {
  buildCreatePayload,
  buildUpdatePayload,
  fromEvent,
  type TEventPayloadBase,
} from "./eventTransforms";

type TEventDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: TPetEvent;
  petId?: string;
  initialData?: Partial<TEventFormData>;
  onSubmit?: (data: TEventFormData) => void;
};

export function EventDialog({
  open,
  onOpenChange,
  event,
  petId,
  initialData,
  onSubmit,
}: TEventDialogProps) {
  const isEdit = Boolean(event);
  const queryClient = useQueryClient();
  const [data, setData] = useState<TEventFormData>(INITIAL_EVENT);
  const [keptExistingFiles, setKeptExistingFiles] = useState<TExistingEventFile[]>([]);

  useEffect(() => {
    if (!open) return undefined;

    const timer = window.setTimeout(() => {
      setData(
        event
          ? fromEvent(event)
          : { ...INITIAL_EVENT, date: todayIsoDate(), ...(initialData ?? {}) },
      );
      setKeptExistingFiles(event?.files ?? []);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [open, event, initialData]);

  const targetPetId = event?.petId ?? petId;

  const handleRemoveExistingFile = (fileId: string) => {
    setKeptExistingFiles((prev) => prev.filter((f) => f.fileId !== fileId));
  };

  const invalidateEvents = async () => {
    if (targetPetId) {
      await queryClient.invalidateQueries({ queryKey: petEventsQueryPrefix(targetPetId) });
      await queryClient.invalidateQueries({ queryKey: petFilesQueryPrefix(targetPetId) });
    }
    await queryClient.invalidateQueries({ queryKey: petsQueryKey });
    if (event?.id) {
      await queryClient.invalidateQueries({ queryKey: eventQueryKey(event.id) });
    }
  };

  const createMutation = useMutation({
    mutationFn: (body: TEventPayloadBase) => {
      if (!petId) throw new Error("Не удалось создать событие: нет идентификатора питомца.");
      return createPetEvent(petId, { ...body, fileIds: [] }, data.files);
    },
    onSuccess: async () => {
      await invalidateEvents();
      toaster.create({
        type: "success",
        title: "Событие добавлено",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toaster.error({
        title: "Не удалось добавить событие",
        description: apiErrorMessage(error, "Попробуйте еще раз."),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (body: TUpdateEventRequest) => {
      if (!event?.id) throw new Error("Не удалось обновить событие: нет идентификатора события.");
      const originalIds = (event.files ?? []).map((f) => f.fileId);
      const keptIds = keptExistingFiles.map((f) => f.fileId);
      const removedIds = originalIds.filter((id) => !keptIds.includes(id));

      const result = await updateEvent(event.id, body, {
        petId: event.petId,
        files: data.files,
        existingFileIds: keptIds,
      });

      if (removedIds.length > 0) {
        await Promise.allSettled(removedIds.map((id) => deleteFile(id)));
      }

      return result;
    },
    onSuccess: async () => {
      await invalidateEvents();
      toaster.create({
        type: "success",
        title: "Событие обновлено",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toaster.error({
        title: "Не удалось обновить событие",
        description: apiErrorMessage(error, "Попробуйте еще раз."),
      });
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const canSubmitToBackend = isEdit ? Boolean(event?.id) : Boolean(petId);
  const subtypeRequired = isEventSubtypeSupported(data.type);
  const subtypeMissing = subtypeRequired && !data.subtype;

  const handleSave = () => {
    if (!canSubmitToBackend) {
      onSubmit?.(data);
      onOpenChange(false);
      return;
    }
    if (isEdit) {
      updateMutation.mutate(buildUpdatePayload(data));
    } else {
      createMutation.mutate(buildCreatePayload(data));
    }
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={(next) => {
        if (isPending) return;
        onOpenChange(next);
      }}
      title={isEdit ? "Редактирование события" : "Добавление нового события"}
      size="md"
      footer={
        <DialogActions
          onCancel={() => onOpenChange(false)}
          onSave={handleSave}
          saveLabel={isEdit ? "Сохранить" : "Добавить"}
          saveDisabled={
            isPending || !data.title.trim() || !data.type || !data.date || subtypeMissing
          }
        />
      }
    >
      <EventForm
        data={data}
        onChange={(patch) => setData((d) => ({ ...d, ...patch }))}
        existingFiles={keptExistingFiles}
        onRemoveExistingFile={isEdit ? handleRemoveExistingFile : undefined}
      />
    </DialogShell>
  );
}
