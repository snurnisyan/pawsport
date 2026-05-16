import { useEffect, useState } from "react";
import { DialogActions } from "@/components/ui/DialogActions";
import { DialogShell } from "@/components/ui/DialogShell";
import type { TPetEvent } from "@/store/pets";
import { EventForm, INITIAL_EVENT, type TEventFormData } from "./EventForm";

type TEventDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: TPetEvent;
  initialData?: Partial<TEventFormData>;
  onSubmit?: (data: TEventFormData) => void;
};

const fromEvent = (event: TPetEvent): TEventFormData => ({
  title: event.title,
  type: event.type,
  petId: event.petId,
  date: event.date,
  time: event.time ?? "",
  nextDate: "",
  reminder: "1d",
  clinic: event.place ?? "",
  comment: event.comment ?? "",
  files: [],
});

export function EventDialog({ open, onOpenChange, event, initialData, onSubmit }: TEventDialogProps) {
  const isEdit = Boolean(event);
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

  const handleSave = () => {
    onSubmit?.(data);
    onOpenChange(false);
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Редактирование события" : "Добавление нового события"}
      size="md"
      footer={
        <DialogActions
          onCancel={() => onOpenChange(false)}
          onSave={handleSave}
          saveLabel={isEdit ? "Сохранить" : "Добавить"}
          saveDisabled={!data.title.trim() || !data.type || !data.date}
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
