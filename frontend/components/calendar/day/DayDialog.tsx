import { useEffect, useMemo, useState } from "react";
import { HStack, Stack, Text } from "@chakra-ui/react";
import { LuPlus } from "react-icons/lu";
import { DialogShell } from "@/components/ui/DialogShell";
import { PrimaryButton } from "@/components/ui/Buttons";
import type { TEventFormData, TPetOption } from "@/components/pets/events/EventForm";
import { DayEventCard, type TDayEvent } from "./DayEventCard";

const RU_MONTH = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

const eventsWord = (count: number) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "событие";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "события";
  return "событий";
};

type TDayDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  events: TDayEvent[];
  pets: TPetOption[];
  isPending?: boolean;
  deletingId?: string | null;
  onCreate?: (data: TEventFormData) => boolean | Promise<boolean>;
  onUpdate?: (
    event: TDayEvent,
    data: TEventFormData,
    keptExistingFileIds: string[]
  ) => boolean | Promise<boolean>;
  onDelete?: (event: TDayEvent) => void;
};

export function DayDialog({
  open,
  onOpenChange,
  date,
  events,
  pets,
  isPending = false,
  deletingId,
  onCreate,
  onUpdate,
  onDelete,
}: TDayDialogProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!open) {
        setExpandedId(null);
        setCreating(false);
      } else if (!creating) {
        setExpandedId(events[0]?.id ?? null);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [open, events, creating]);

  const title = `${date.getDate()} ${RU_MONTH[date.getMonth()]}`;
  const subtitle = `${events.length} ${eventsWord(events.length)}`;

  const hasContent = creating || events.length > 0;
  const initialCreateData = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      petId: pets.length === 1 ? pets[0].value : "",
    };
  }, [date, pets]);

  return (
    <DialogShell
      open={open}
      onOpenChange={(next) => {
        if (isPending) return;
        onOpenChange(next);
      }}
      title={title}
      subtitle={subtitle}
      footer={
        <PrimaryButton
          w="full"
          onClick={() => {
            setCreating(true);
            setExpandedId(null);
          }}
          disabled={creating || isPending || pets.length === 0}
        >
          <HStack gap="8px">
            <LuPlus />
            <Text>{pets.length === 0 ? "Сначала добавьте питомца" : "Добавить новое событие"}</Text>
          </HStack>
        </PrimaryButton>
      }
    >
      {!hasContent ? (
        <Stack align="center" py="32px">
          <Text fontSize="14px" color="fg.muted">
            На этот день нет событий
          </Text>
        </Stack>
      ) : (
        <Stack gap="8px">
          {creating && (
            <DayEventCard
              pets={pets}
              expanded
              initialData={initialCreateData}
              isPending={isPending}
              onSave={async (data) => {
                const saved = (await onCreate?.(data)) ?? false;
                if (saved) setCreating(false);
                return saved;
              }}
              onCancel={() => setCreating(false)}
            />
          )}
          {events.map((event) => (
            <DayEventCard
              key={event.id}
              event={event}
              pets={pets}
              expanded={expandedId === event.id}
              onToggle={() =>
                setExpandedId((cur) => (cur === event.id ? null : event.id))
              }
              isPending={isPending}
              isDeleting={deletingId === event.id}
              onSave={(data, keptExistingFileIds) =>
                onUpdate?.(event, data, keptExistingFileIds) ?? false
              }
              onDelete={onDelete}
            />
          ))}
        </Stack>
      )}
    </DialogShell>
  );
}
