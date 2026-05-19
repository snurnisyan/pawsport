import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { useEffect, useMemo, useState } from "react";
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
import { MiniMonth, type TMiniDayEvent } from "@/components/calendar/MiniMonth";
import { DayDialog } from "@/components/calendar/day/DayDialog";
import type { TDayEvent } from "@/components/calendar/day/DayEventCard";
import type { TEventFormData } from "@/components/pets/events/EventForm";
import { buildPayload } from "@/components/pets/events/eventFormMapping";
import { AppWrapper } from "@/components/layout/AppWrapper";
import { toaster } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api";
import {
  calendarQueryKey,
  useCalendarEventsQuery,
  type TCalendarQuery,
} from "@/lib/calendarApi";
import {
  createPetEvent,
  eventQueryKey,
  petEventsQueryPrefix,
  updateEvent,
  type TPetEvent,
} from "@/lib/eventsApi";
import {
  EVENT_TYPE_FILTER_OPTIONS,
} from "@/lib/eventTypes";
import {
  deleteFile,
  petFilesQueryPrefix,
  petsQueryKey,
  usePetsQuery,
  type TPetDetail,
} from "@/lib/petsApi";
import type { TPetEventType } from "@/store/pets";

type TSelectedDay = { year: number; month: number; day: number };
type TEventsByMonth = Record<number, Record<number, TDayEvent[]>>;
type TMiniEventsByMonth = Record<number, Record<number, TMiniDayEvent[]>>;

const EMPTY_EVENTS: TPetEvent[] = [];

const ALL_EVENT_TYPES = EVENT_TYPE_FILTER_OPTIONS.map(
  (option) => option.value
) as TPetEventType[];

const SEX_LABEL: Record<TPetDetail["sex"], string> = {
  male: "мальчик",
  female: "девочка",
  unknown: "пол не указан",
};

const SPECIES_LABEL: Record<string, string> = {
  dog: "собака",
  cat: "кот",
  other: "питомец",
};

const pad = (n: number) => String(n).padStart(2, "0");

const dateParam = (year: number, month: number, day: number) =>
  `${year}-${pad(month)}-${pad(day)}`;

const sameValues = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value, idx) => value === b[idx]);

const apiErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof ApiError ? error.message : fallback;

const formatEventDate = (iso: string): string | undefined => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const formatEventTime = (iso: string): string | undefined => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const petDescription = (pet?: TPetDetail): string | undefined => {
  if (!pet) return undefined;
  const species = SPECIES_LABEL[pet.species] ?? "питомец";
  const breed = pet.breed ? `, ${pet.breed}` : "";
  return `${pet.name}, ${species}${breed} (${SEX_LABEL[pet.sex]})`;
};

const toDayEvent = (
  event: TPetEvent,
  petsById: Map<string, TPetDetail>
): TDayEvent | undefined => {
  const time = formatEventTime(event.eventDate);
  if (!time) return undefined;

  const pet = petsById.get(event.petId);

  return {
    id: event.id,
    type: event.type,
    subtype: event.subtype,
    time,
    title: event.title,
    petId: event.petId,
    petName: pet?.name ?? "Питомец",
    petDescription: petDescription(pet),
    place: event.clinicName,
    comment: event.comment,
    nextDate: event.nextDate ? formatEventDate(event.nextDate) : undefined,
    reminder: event.reminderOffset ?? "none",
    files: event.files,
    source: event,
  };
};

const groupEventsByMonth = (
  events: TPetEvent[],
  petsById: Map<string, TPetDetail>
): TEventsByMonth => {
  const grouped: TEventsByMonth = {};

  for (const event of events) {
    const date = new Date(event.eventDate);
    if (Number.isNaN(date.getTime())) continue;

    const viewEvent = toDayEvent(event, petsById);
    if (!viewEvent) continue;

    const month = date.getMonth();
    const day = date.getDate();
    grouped[month] ??= {};
    grouped[month][day] ??= [];
    grouped[month][day].push(viewEvent);
  }

  for (const days of Object.values(grouped)) {
    for (const dayEvents of Object.values(days)) {
      dayEvents.sort((a, b) => {
        const byTime =
          new Date(a.source.eventDate).getTime() -
          new Date(b.source.eventDate).getTime();
        if (byTime !== 0) return byTime;
        const byTitle = a.title.localeCompare(b.title, "ru");
        if (byTitle !== 0) return byTitle;
        return a.id.localeCompare(b.id);
      });
    }
  }

  return grouped;
};

const toMiniEvents = (eventsByMonth: TEventsByMonth): TMiniEventsByMonth => {
  const result: TMiniEventsByMonth = {};
  for (const [monthKey, days] of Object.entries(eventsByMonth)) {
    const month = Number(monthKey);
    result[month] = {};
    for (const [dayKey, events] of Object.entries(days)) {
      result[month][Number(dayKey)] = events.map((event) => ({
        mark: event.type,
        title: event.title,
        petName: event.petName,
        time: event.time,
      }));
    }
  }
  return result;
};

const toMarks = (eventsByMonth: TEventsByMonth) => {
  const result: Record<number, Record<number, TPetEventType[]>> = {};
  for (const [monthKey, days] of Object.entries(eventsByMonth)) {
    const month = Number(monthKey);
    result[month] = {};
    for (const [dayKey, events] of Object.entries(days)) {
      result[month][Number(dayKey)] = Array.from(
        new Set(events.map((event) => event.type))
      );
    }
  }
  return result;
};

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState<TSelectedDay | null>(null);
  const [selectedEventTypes, setSelectedEventTypes] =
    useState<TPetEventType[]>(ALL_EVENT_TYPES);
  const [selectedPetIds, setSelectedPetIds] = useState<string[]>([]);
  const [petFilterTouched, setPetFilterTouched] = useState(false);
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSelectedPetIds((current) => {
        if (!petFilterTouched) return sameValues(current, petIds) ? current : petIds;
        const valid = current.filter((id) => petIds.includes(id));
        return sameValues(current, valid) ? current : valid;
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [petFilterTouched, petIds]);

  const calendarQuery = useMemo<TCalendarQuery>(() => {
    const allPetsSelected =
      pets.length > 0 && selectedPetIds.length === pets.length;
    const allTypesSelected = selectedEventTypes.length === ALL_EVENT_TYPES.length;

    return {
      from: dateParam(year, 1, 1),
      to: dateParam(year, 12, 31),
      petIds: allPetsSelected ? undefined : selectedPetIds,
      eventTypes: allTypesSelected ? undefined : selectedEventTypes,
    };
  }, [pets.length, selectedEventTypes, selectedPetIds, year]);

  const calendarEnabled =
    !petsQuery.isLoading &&
    selectedPetIds.length > 0 &&
    selectedEventTypes.length > 0;
  const calendarQueryResult = useCalendarEventsQuery(
    calendarQuery,
    calendarEnabled
  );

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

  const createMutation = useMutation({
    mutationFn: async (data: TEventFormData) => {
      if (!data.petId) throw new Error("Выберите питомца для события.");
      const payload = buildPayload(data);
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
      const payload = buildPayload(data);
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

  const mutationPending = createMutation.isPending || updateMutation.isPending;
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

  const emptyFiltered = selectedEventTypes.length === 0 || selectedPetIds.length === 0;
  const emptyEvents =
    calendarEnabled &&
    !calendarQueryResult.isLoading &&
    !calendarQueryResult.isError &&
    backendEvents.length === 0;

  const filters = (
    <CalendarFilters
      selectedEventTypes={selectedEventTypes}
      selectedPetIds={selectedPetIds}
      pets={petOptions}
      petsLoading={petsQuery.isLoading}
      petsError={petsError}
      onEventTypesChange={setSelectedEventTypes}
      onPetIdsChange={(ids) => {
        setPetFilterTouched(true);
        setSelectedPetIds(ids);
      }}
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
                  {calendarError ? (
                    <LuSearchX />
                  ) : emptyEvents || emptyFiltered ? (
                    <LuCalendarOff />
                  ) : (
                    <LuCalendarOff />
                  )}
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
        />
      </AppWrapper>
    </>
  );
}
