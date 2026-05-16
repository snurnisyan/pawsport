import { useEffect, useState } from "react";
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
  onCreate?: (data: TEventFormData) => void;
  onUpdate?: (eventId: string, data: TEventFormData) => void;
};

export function DayDialog({ open,
                            onOpenChange,
                            date,
                            events,
                            pets,
                            onCreate,
                            onUpdate }: TDayDialogProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) {
      setExpandedId(null);
      setCreating(false);
    } else if (!creating) {
      setExpandedId(events[0]?.id ?? null);
    }
  }, [open, events, creating]);

  const title = `${date.getDate()} ${RU_MONTH[date.getMonth()]}`;
  const subtitle = `${events.length} ${eventsWord(events.length)}`;

  const hasContent = creating || events.length > 0;

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      subtitle={subtitle}
      footer={
        <PrimaryButton
          w="full"
          onClick={() => {
            setCreating(true);
            setExpandedId(null);
          }}
          disabled={creating}
        >
          <HStack gap="8px">
            <LuPlus />
            <Text>Добавить новое событие</Text>
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
              onSave={(data) => {
                onCreate?.(data);
                setCreating(false);
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
              onSave={(data) => onUpdate?.(event.id, data)}
            />
          ))}
        </Stack>
      )}
    </DialogShell>
  );
}
