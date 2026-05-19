import {
  Box,
  Drawer,
  Grid,
  HStack,
  Icon,
  IconButton,
  Stack,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import Head from "next/head";
import { useMemo, useState } from "react";
import {
  LuCalendarOff,
  LuChevronLeft,
  LuChevronRight,
  LuFilter,
  LuSearchX,
} from "react-icons/lu";
import {
  CalendarFilters,
  type TCalendarPetFilterOption,
} from "@/components/calendar/CalendarFilters";
import { MiniMonth } from "@/components/calendar/miniMonth/MiniMonth";
import { DayDialog } from "@/components/calendar/day/DayDialog";
import {
  groupEventsByMonth,
  toMarks,
  toMiniEvents,
} from "@/components/calendar/eventGrouping";
import { useCalendarFilters } from "@/components/calendar/hooks/useCalendarFilters";
import { useCalendarMutations } from "@/components/calendar/hooks/useCalendarMutations";
import type { TDayEvent } from "@/components/calendar/day/DayEventCard";
import { AppWrapper } from "@/components/layout/AppWrapper";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ApiError } from "@/lib/api";
import {
  useCalendarEventsQuery,
  type TCalendarQuery,
} from "@/lib/calendarApi";
import type { TPetEvent } from "@/lib/eventsApi";
import { usePetsQuery } from "@/lib/petsApi";
import { dateParam } from "@/utils/dates";

type TSelectedDay = { year: number; month: number; day: number };

const EMPTY_EVENTS: TPetEvent[] = [];

export default function CalendarPage() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState<TSelectedDay | null>(null);
  const [eventToDelete, setEventToDelete] = useState<TDayEvent | null>(null);
  const drawer = useDisclosure();

  const petsQuery = usePetsQuery();
  const pets = useMemo(() => petsQuery.data?.items ?? [], [petsQuery.data?.items]);
  const petOptions = useMemo<TCalendarPetFilterOption[]>(
    () => pets.map((pet) => ({ value: pet.id, label: pet.name })),
    [pets]
  );
  const petIds = useMemo(() => pets.map((pet) => pet.id), [pets]);
  const petsById = useMemo(
    () => new Map(pets.map((pet) => [pet.id, pet])),
    [pets]
  );

  const {
    allEventTypes,
    selectedEventTypes,
    setSelectedEventTypes,
    effectiveSelectedPetIds,
    selectPetIds,
  } = useCalendarFilters(petIds);

  const calendarQuery = useMemo<TCalendarQuery>(() => {
    const allPetsSelected =
      pets.length > 0 && effectiveSelectedPetIds.length === pets.length;
    const allTypesSelected = selectedEventTypes.length === allEventTypes.length;

    return {
      from: dateParam(year, 1, 1),
      to: dateParam(year, 12, 31),
      petIds: allPetsSelected ? undefined : effectiveSelectedPetIds,
      eventTypes: allTypesSelected ? undefined : selectedEventTypes,
    };
  }, [
    allEventTypes.length,
    effectiveSelectedPetIds,
    pets.length,
    selectedEventTypes,
    year,
  ]);

  const calendarEnabled =
    !petsQuery.isLoading &&
    effectiveSelectedPetIds.length > 0 &&
    selectedEventTypes.length > 0;
  const calendarQueryResult = useCalendarEventsQuery(calendarQuery, calendarEnabled);

  const backendEvents = useMemo(
    () =>
      calendarEnabled
        ? calendarQueryResult.data?.events ?? EMPTY_EVENTS
        : EMPTY_EVENTS,
    [calendarEnabled, calendarQueryResult.data?.events]
  );

  const eventsByMonth = useMemo(
    () => groupEventsByMonth(backendEvents, petsById),
    [backendEvents, petsById]
  );
  const miniEventsByMonth = useMemo(() => toMiniEvents(eventsByMonth), [eventsByMonth]);
  const marksByMonth = useMemo(() => toMarks(eventsByMonth), [eventsByMonth]);

  const dayEvents = selectedDay
    ? eventsByMonth[selectedDay.month]?.[selectedDay.day] ?? []
    : [];
  const dayDate = selectedDay
    ? new Date(selectedDay.year, selectedDay.month, selectedDay.day)
    : new Date();

  const { createMutation, updateMutation, deleteMutation } =
    useCalendarMutations(calendarQuery);
  const mutationPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const deletingId = deleteMutation.variables?.id ?? null;

  const petsError =
    petsQuery.error instanceof ApiError
      ? petsQuery.error.message
      : petsQuery.isError
        ? "Не удалось загрузить питомцев"
        : undefined;
  const calendarError =
    calendarQueryResult.error instanceof ApiError
      ? calendarQueryResult.error.message
      : calendarQueryResult.isError
        ? "Попробуйте обновить страницу."
        : undefined;

  const emptyFiltered =
    !petsQuery.isLoading &&
    (selectedEventTypes.length === 0 || effectiveSelectedPetIds.length === 0);
  const emptyEvents =
    calendarEnabled &&
    !calendarQueryResult.isLoading &&
    !calendarQueryResult.isError &&
    backendEvents.length === 0;

  const filters = (
    <CalendarFilters
      selectedEventTypes={selectedEventTypes}
      selectedPetIds={effectiveSelectedPetIds}
      pets={petOptions}
      petsLoading={petsQuery.isLoading}
      petsError={petsError}
      onEventTypesChange={setSelectedEventTypes}
      onPetIdsChange={selectPetIds}
    />
  );

  return (
    <>
      <Head>
        <title>Календарь — Pawsport</title>
      </Head>
      <AppWrapper maxW="1440px">
        <Grid
          templateColumns={["1fr", null, null, "1fr 240px"]}
          gap={["16px", null, null, "32px"]}
          alignItems="start"
        >
          <Stack gap="20px">
            <HStack
              justify={["space-between", null, null, "center"]}
              align="center"
              gap="8px"
            >
              <Box
                w="40px"
                h="40px"
                flexShrink={0}
                display={["block", null, null, "none"]}
              />
              <HStack
                gap="8px"
                bg="bg.surface"
                borderWidth="1px"
                borderColor="border.subtle"
                rounded="16px"
                px="8px"
                py="6px"
                shadow="card"
              >
                <IconButton
                  aria-label="Предыдущий год"
                  variant="ghost"
                  size="sm"
                  rounded="full"
                  color="fg.muted"
                  onClick={() => setYear((y) => y - 1)}
                  _hover={{ color: "fg.default", bg: "secondary.700" }}
                >
                  <LuChevronLeft />
                </IconButton>
                <Text
                  fontSize="20px"
                  fontWeight={700}
                  minW="80px"
                  textAlign="center"
                >
                  {year}
                </Text>
                <IconButton
                  aria-label="Следующий год"
                  variant="ghost"
                  size="sm"
                  rounded="full"
                  color="fg.muted"
                  onClick={() => setYear((y) => y + 1)}
                  _hover={{ color: "fg.default", bg: "secondary.700" }}
                >
                  <LuChevronRight />
                </IconButton>
              </HStack>
              <IconButton
                aria-label="Фильтры"
                display={["inline-flex", null, null, "none"]}
                onClick={drawer.onOpen}
                variant="ghost"
                bg="bg.surface"
                borderWidth="1px"
                borderColor="border.subtle"
                rounded="full"
                w="40px"
                h="40px"
                flexShrink={0}
                color="fg.muted"
                shadow="card"
                _hover={{ color: "fg.default", bg: "secondary.700" }}
              >
                <LuFilter />
              </IconButton>
            </HStack>

            {calendarQueryResult.isLoading || emptyFiltered || emptyEvents || calendarError ? (
              <HStack
                gap="10px"
                bg="bg.surface"
                borderWidth="1px"
                borderColor="border.subtle"
                rounded="card"
                px="16px"
                py="12px"
                color={calendarError ? "red.200" : "fg.muted"}
              >
                <Icon>
                  {calendarError ? <LuSearchX /> : <LuCalendarOff />}
                </Icon>
                <Text fontSize="14px">
                  {calendarError ??
                    (emptyFiltered
                      ? "Нет выбранных питомцев или типов событий"
                      : emptyEvents
                        ? "Событий по выбранным фильтрам нет"
                        : "Загружаем события...")}
                </Text>
              </HStack>
            ) : null}

            <Grid
              templateColumns={["1fr", "1fr 1fr", "repeat(3, 1fr)"]}
              gap="16px"
            >
              {Array.from({ length: 12 }).map((_, m) => (
                <MiniMonth
                  key={m}
                  year={year}
                  month={m}
                  marks={marksByMonth[m] || {}}
                  eventsByDay={miniEventsByMonth[m] || {}}
                  onDayClick={(day) => setSelectedDay({ year, month: m, day })}
                  onDayExpand={(day) => setSelectedDay({ year, month: m, day })}
                />
              ))}
            </Grid>
          </Stack>

          <Box display={["none", null, null, "block"]} position="sticky" top="80px">
            {filters}
          </Box>
        </Grid>

        <Drawer.Root
          open={drawer.open}
          onOpenChange={(d) => (d.open ? drawer.onOpen() : drawer.onClose())}
          placement="end"
        >
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content bg="bg.surface" maxW="320px">
              <Drawer.Header px="20px" py="16px" borderBottomWidth="1px" borderColor="border.subtle">
                <Drawer.Title>Фильтры</Drawer.Title>
              </Drawer.Header>
              <Drawer.Body px="20px" py="20px">
                {filters}
              </Drawer.Body>
            </Drawer.Content>
          </Drawer.Positioner>
        </Drawer.Root>

        <DayDialog
          open={selectedDay !== null}
          onOpenChange={(o) => !o && setSelectedDay(null)}
          date={dayDate}
          events={dayEvents}
          pets={petOptions}
          isPending={mutationPending}
          deletingId={deletingId}
          onCreate={async (data) => {
            try {
              await createMutation.mutateAsync(data);
              return true;
            } catch {
              return false;
            }
          }}
          onUpdate={async (event, data, keptExistingFileIds) => {
            try {
              await updateMutation.mutateAsync({ event, data, keptExistingFileIds });
              return true;
            } catch {
              return false;
            }
          }}
          onDelete={(event) => setEventToDelete(event)}
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
            if (!eventToDelete) return;
            deleteMutation.mutate(eventToDelete, {
              onSuccess: () => setEventToDelete(null),
            });
          }}
        />
      </AppWrapper>
    </>
  );
}
