import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DialogActions } from "@/components/ui/DialogActions";
import { DialogShell } from "@/components/ui/DialogShell";
import { toaster } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api";
import {
  createPetEvent,
  eventQueryKey,
  petEventsQueryKey,
  updateEvent,
  type TCreateEventRequest,
  type TPetEvent,
  type TUpdateEventRequest,
} from "@/lib/eventsApi";
import type { TPetEventType } from "@/store/pets";
import {
  EventForm,
  INITIAL_EVENT,
  type TEventFormData,
  type TReminderValue,
} from "./EventForm";

type TEventDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: TPetEvent;
  petId?: string;
  initialData?: Partial<TEventFormData>;
  onSubmit?: (data: TEventFormData) => void;
};

const splitDateTime = (iso: string): { date: string; time: string } => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { date, time };
};

const toIsoDateTime = (date: string, time?: string): string => {
  const hhmm = time && time.length > 0 ? time : "00:00";
  return new Date(`${date}T${hhmm}:00`).toISOString();
};

const fromEvent = (event: TPetEvent): TEventFormData => {
  const { date, time } = splitDateTime(event.eventDate);
  return {
    title: event.title,
    type: event.type,
    petId: event.petId,
    date,
    time,
    nextDate: event.nextDate ? splitDateTime(event.nextDate).date : "",
    reminder: (event.reminderOffset ?? "none") as TReminderValue,
    clinic: event.clinicName ?? "",
    comment: event.comment ?? "",
    files: [],
  };
};

const buildPayload = (data: TEventFormData): TCreateEventRequest => ({
  type: data.type as TPetEventType,
  title: data.title.trim(),
  eventDate: toIsoDateTime(data.date, data.time),
  nextDate: data.nextDate ? toIsoDateTime(data.nextDate) : undefined,
  clinicName: data.clinic.trim() || undefined,
  comment: data.comment.trim() || undefined,
  reminderOffset: data.reminder === "none" ? undefined : data.reminder,
  fileIds: [],
});

const apiErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof ApiError ? error.message : fallback;

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

  useEffect(() => {
    if (open) {
      setData(
        event
          ? fromEvent(event)
          : { ...INITIAL_EVENT, ...(initialData ?? {}) },
      );
    }
  }, [open, event, initialData]);

  const targetPetId = event?.petId ?? petId;

  const invalidateEvents = async () => {
    if (targetPetId) {
      await queryClient.invalidateQueries({ queryKey: petEventsQueryKey(targetPetId) });
    }
    if (event?.id) {
      await queryClient.invalidateQueries({ queryKey: eventQueryKey(event.id) });
    }
  };

  const createMutation = useMutation({
    mutationFn: (body: TCreateEventRequest) => {
      if (!petId) throw new Error("Не удалось создать событие: нет идентификатора питомца.");
      return createPetEvent(petId, body);
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
    mutationFn: (body: TUpdateEventRequest) => {
      if (!event?.id) throw new Error("Не удалось обновить событие: нет идентификатора события.");
      return updateEvent(event.id, body);
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

  const handleSave = () => {
    if (!canSubmitToBackend) {
      onSubmit?.(data);
      onOpenChange(false);
      return;
    }
    const payload = buildPayload(data);
    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
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
            isPending || !data.title.trim() || !data.type || !data.date
          }
        />
      }
    >
      <EventForm
        data={data}
        onChange={(patch) => setData((d) => ({ ...d, ...patch }))}
      />
    </DialogShell>
  );
}
