import { useMemo, useState } from "react";
import { HStack, Heading, Icon, Stack, Text } from "@chakra-ui/react";
import { LuCalendarOff, LuPlus, LuSearchX } from "react-icons/lu";
import { SecondaryButton } from "@/components/ui/Buttons";
import { EventDialog } from "@/components/pets/events/EventDialog";
import { EventsFeed } from "@/components/pets/events/EventsFeed";
import { EventsFilterBar } from "@/components/pets/events/EventsFilterBar";
import {
  INITIAL_FILTERS,
  filterEvents,
  type TEventsFilters,
} from "@/components/pets/events/eventsShared";
import { ApiError } from "@/lib/api";
import { usePetEventsQuery, type TPetEvent } from "@/lib/eventsApi";

type TEventsTabProps = {
  petId?: string;
};

export function EventsTab({ petId }: TEventsTabProps) {
  const eventsQuery = usePetEventsQuery(petId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TPetEvent | null>(null);
  const [filters, setFilters] = useState<TEventsFilters>(INITIAL_FILTERS);

  const events = eventsQuery.data?.items ?? [];
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

  const errorDetail =
    eventsQuery.error instanceof ApiError
      ? eventsQuery.error.message
      : "Попробуйте обновить страницу.";

  return (
    <Stack gap="24px">
      <HStack justify="space-between" flexWrap="wrap" gap="12px">
        <Stack gap="4px">
          <Heading size="lg">Лента событий</Heading>
          <Text color="fg.muted" fontSize="14px">
            Будущие и прошедшие события по питомцу
          </Text>
        </Stack>
        <SecondaryButton h="44px" px="20px" onClick={openCreate} disabled={!petId}>
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
        petId={petId}
      />

      {eventsQuery.isLoading ? (
        <Text color="fg.muted">Загружаем события...</Text>
      ) : eventsQuery.isError ? (
        <Stack gap="6px">
          <Text fontWeight={700} color="red.200">
            Не удалось загрузить события
          </Text>
          <Text color="fg.muted" fontSize="14px">
            {errorDetail}
          </Text>
        </Stack>
      ) : events.length === 0 ? (
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
          {filtered.length === 0 ? (
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
                <LuSearchX />
              </Icon>
              <Text color="fg.muted" fontSize="14px">
                Ничего не найдено
              </Text>
            </Stack>
          ) : (
            <EventsFeed events={filtered} onEdit={openEdit} />
          )}
        </>
      )}
    </Stack>
  );
}
