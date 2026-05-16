import { useMemo, useState } from "react";
import { HStack, Heading, Icon, Stack, Text } from "@chakra-ui/react";
import { LuCalendarOff, LuPlus } from "react-icons/lu";
import { SecondaryButton } from "@/components/ui/Buttons";
import { EventDialog } from "@/components/pets/events/EventDialog";
import { EventsFeed } from "@/components/pets/events/EventsFeed";
import { EventsFilterBar } from "@/components/pets/events/EventsFilterBar";
import {
  INITIAL_FILTERS,
  filterEvents,
  type TEventsFilters,
} from "@/components/pets/events/eventsShared";
import type { TPetEvent } from "@/store/pets";

type TEventsTabProps = {
  events: TPetEvent[];
};

export function EventsTab({ events }: TEventsTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TPetEvent | null>(null);
  const [filters, setFilters] = useState<TEventsFilters>(INITIAL_FILTERS);

  const filtered = useMemo(() => filterEvents(events, filters), [events, filters]);

  const openCreate = () => {
    setEditingEvent(null);
    setDialogOpen(true);
  };
  const openEdit = (event: TPetEvent) => {
    setEditingEvent(event);
    setDialogOpen(true);
  };
  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingEvent(null);
  };

  return (
    <Stack gap="24px">
      <HStack justify="space-between" flexWrap="wrap" gap="12px">
        <Stack gap="4px">
          <Heading size="lg">Лента событий</Heading>
          <Text color="fg.muted" fontSize="14px">
            Будущие и прошедшие события по питомцу
          </Text>
        </Stack>
        <SecondaryButton h="44px" px="20px" onClick={openCreate}>
          <HStack gap="8px">
            <LuPlus />
            <Text>Добавить событие</Text>
          </HStack>
        </SecondaryButton>
      </HStack>

      <EventDialog
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        event={editingEvent ?? undefined}
      />

      {events.length === 0 ? (
        <Stack
          align="center"
          gap="12px"
          py="64px"
          bg="bg.surface"
          borderWidth="1px"
          borderStyle="dashed"
          borderColor="border.subtle"
          rounded="card"
        >
          <Icon boxSize="32px" color="fg.muted">
            <LuCalendarOff />
          </Icon>
          <Text color="fg.muted" fontSize="14px">
            У этого питомца ещё нет событий
          </Text>
        </Stack>
      ) : (
        <>
          <EventsFilterBar value={filters} onChange={setFilters} />
          <EventsFeed events={filtered} onEdit={openEdit} />
        </>
      )}
    </Stack>
  );
}
