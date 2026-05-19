import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { HStack, Heading, Icon, Stack, Text } from "@chakra-ui/react";
import { LuCalendarOff, LuPlus, LuSearchX } from "react-icons/lu";
import { SecondaryButton } from "@/components/ui/Buttons";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toaster } from "@/components/ui/toaster";
import { EventDialog } from "@/components/pets/events/EventDialog";
import { EventsFeed } from "@/components/pets/events/EventsFeed";
import { EventsFilterBar } from "@/components/pets/events/EventsFilterBar";
import {
  INITIAL_FILTERS,
  filterEvents,
  type TEventsFilters,
} from "@/components/pets/events/eventsShared";
import { ApiError } from "@/lib/api";
import {
  deleteEvent,
  petEventsQueryPrefix,
  usePetEventsQuery,
  type TPetEvent,
  type TPetEventsQuery,
} from "@/lib/eventsApi";
import {
  petFilesQueryPrefix,
  type TPetFileListResponse,
} from "@/lib/petsApi";

type TEventsTabProps = {
  petId?: string;
};

const apiErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof ApiError ? error.message : fallback;

const EMPTY_EVENTS: TPetEvent[] = [];

const hasActiveFilters = (filters: TEventsFilters): boolean =>
  Boolean(
    filters.search.trim() ||
      filters.types.length > 0 ||
      filters.dateRange.from ||
      filters.dateRange.to
  );

export function EventsTab({ petId }: TEventsTabProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TPetEvent | null>(null);
  const [eventToDelete, setEventToDelete] = useState<TPetEvent | null>(null);
  const [filters, setFilters] = useState<TEventsFilters>(INITIAL_FILTERS);

  const backendQuery = useMemo<TPetEventsQuery>(
    () => ({
      from: filters.dateRange.from || undefined,
      to: filters.dateRange.to || undefined,
      eventTypes:
        filters.types.length > 0
          ? (filters.types as NonNullable<TPetEventsQuery["eventTypes"]>)
          : undefined,
    }),
    [filters.dateRange.from, filters.dateRange.to, filters.types]
  );

  const eventsQuery = usePetEventsQuery(petId, backendQuery);

  const backendEvents = eventsQuery.data?.items ?? EMPTY_EVENTS;
  const filtered = useMemo(
    () => filterEvents(backendEvents, filters),
    [backendEvents, filters]
  );
  const filtersActive = hasActiveFilters(filters);

  const deleteMutation = useMutation({
    mutationFn: (event: TPetEvent) => deleteEvent(event.id).then(() => event),
    onSuccess: async (event) => {
      const targetPetId = petId ?? event.petId;
      if (targetPetId) {
        const deletedFileIds = new Set((event.files ?? []).map((file) => file.fileId));
        if (deletedFileIds.size > 0) {
          queryClient.setQueriesData<TPetFileListResponse>(
            { queryKey: petFilesQueryPrefix(targetPetId) },
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
          queryClient.invalidateQueries({ queryKey: petEventsQueryPrefix(targetPetId) }),
          queryClient.invalidateQueries({ queryKey: petFilesQueryPrefix(targetPetId) }),
        ]);
      }
      toaster.create({ type: "success", title: "Событие удалено" });
      setEventToDelete(null);
    },
    onError: (error) => {
      toaster.error({
        title: "Не удалось удалить событие",
        description: apiErrorMessage(error, "Попробуйте еще раз."),
      });
    },
  });

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

      <ConfirmDialog
        open={Boolean(eventToDelete)}
        onOpenChange={(open) => {
          if (!open) setEventToDelete(null);
        }}
        title="Удалить событие?"
        description="Событие будет удалено из карточки питомца."
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (eventToDelete) deleteMutation.mutate(eventToDelete);
        }}
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
      ) : backendEvents.length === 0 && !filtersActive ? (
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
            <EventsFeed
              events={filtered}
              onEdit={openEdit}
              onDelete={(event) => setEventToDelete(event)}
            />
          )}
        </>
      )}
    </Stack>
  );
}
