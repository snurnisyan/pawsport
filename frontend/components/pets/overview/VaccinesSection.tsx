import { Box, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { LuSyringe } from "react-icons/lu";
import { Card } from "@/components/ui/Card";
import { ApiError } from "@/lib/api";
import { EVENT_TYPE_META } from "@/lib/eventTypes";
import {
  listPetEvents,
  petEventsQueryKey,
  type TPetEvent,
} from "@/lib/petsApi";
import { SectionCardHeader } from "./SectionCardHeader";

type TVaccinesSectionProps = {
  backendPetId?: string;
};

type TUpcomingItem = {
  id: string;
  title: string;
  type: "vaccine" | "treatment";
  nextDate: Date;
  eventDate?: Date;
};

const DEMO_ITEMS: TUpcomingItem[] = [
  {
    id: "demo-vaccine",
    title: "Бешенство (Nobivac)",
    type: "vaccine",
    nextDate: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "demo-treatment",
    title: "Внешние паразиты",
    type: "treatment",
    nextDate: new Date("2026-05-01T00:00:00.000Z"),
  },
];

const formatDate = (date: Date): string =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

const parseDate = (value?: string): Date | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const isOverviewEventType = (
  type: TPetEvent["type"]
): type is TUpcomingItem["type"] => type === "vaccine" || type === "treatment";

const toUpcomingItems = (events: TPetEvent[], nowMs: number): TUpcomingItem[] =>
  events
    .flatMap((event) => {
      if (!isOverviewEventType(event.type)) return [];
      const nextDate = parseDate(event.nextDate);
      if (!nextDate || nextDate.getTime() <= nowMs) return [];
      return [
        {
          id: event.id,
          title: event.title,
          type: event.type,
          nextDate,
          eventDate: parseDate(event.eventDate),
        },
      ];
    })
    .sort((a, b) => {
      const byDate = a.nextDate.getTime() - b.nextDate.getTime();
      if (byDate !== 0) return byDate;
      const byTitle = a.title.localeCompare(b.title, "ru");
      if (byTitle !== 0) return byTitle;
      return a.id.localeCompare(b.id);
    });

function EventRow({ item }: { item: TUpcomingItem }) {
  const meta = EVENT_TYPE_META[item.type];
  const EventIcon = meta.Icon;

  return (
    <HStack
      justify="space-between"
      align={["flex-start", "center"]}
      flexDir={["column", "row"]}
      bg="secondary.700"
      rounded="lg"
      p="16px"
      minH="76px"
      gap="16px"
    >
      <HStack gap="12px" minW={0}>
        <Box
          w="28px"
          h="28px"
          rounded="md"
          bg={meta.bg}
          color={meta.color}
          display="flex"
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          <Icon boxSize="14px">
            <EventIcon />
          </Icon>
        </Box>
        <Stack gap="2px" minW={0}>
          <Text fontWeight={500} fontSize="14px" lineClamp={1}>
            {item.title}
          </Text>
          <Text fontSize="12px" color="fg.muted">
            {meta.label}
            {item.eventDate ? ` · Последнее событие: ${formatDate(item.eventDate)}` : ""}
          </Text>
        </Stack>
      </HStack>
      <Text
        fontSize="12px"
        color="fg.muted"
        textAlign={["left", "right"]}
        flexShrink={0}
      >
        Следующая дата: {formatDate(item.nextDate)}
      </Text>
    </HStack>
  );
}

function LoadingRows() {
  return (
    <>
      {[0, 1].map((idx) => (
        <HStack
          key={idx}
          justify="space-between"
          bg="secondary.700"
          rounded="lg"
          p="16px"
          minH="76px"
        >
          <HStack gap="12px">
            <Box w="28px" h="28px" rounded="md" bg="secondary.500" />
            <Stack gap="8px">
              <Box w="160px" h="12px" rounded="full" bg="secondary.500" />
              <Box w="110px" h="10px" rounded="full" bg="secondary.500" />
            </Stack>
          </HStack>
          <Box w="126px" h="10px" rounded="full" bg="secondary.500" />
        </HStack>
      ))}
    </>
  );
}

export function VaccinesSection({ backendPetId }: TVaccinesSectionProps) {
  const nextDateFrom = useMemo(() => new Date().toISOString(), [backendPetId]);
  const nowMs = useMemo(() => Date.parse(nextDateFrom), [nextDateFrom]);

  const eventsQuery = useQuery({
    queryKey: backendPetId
      ? petEventsQueryKey(backendPetId, { nextDateFrom })
      : petEventsQueryKey("demo"),
    queryFn: () => listPetEvents(backendPetId!, { nextDateFrom }),
    enabled: Boolean(backendPetId),
    staleTime: 30_000,
  });

  const items = useMemo(() => {
    if (!backendPetId) return DEMO_ITEMS;
    return toUpcomingItems(eventsQuery.data?.items ?? [], nowMs);
  }, [backendPetId, eventsQuery.data?.items, nowMs]);

  const errorDetail =
    eventsQuery.error instanceof ApiError
      ? eventsQuery.error.message
      : "Попробуйте обновить страницу.";

  return (
    <Card>
      <SectionCardHeader icon={<LuSyringe />} title="Вакцины и обработки" />
      <Stack gap="12px">
        {backendPetId && eventsQuery.isLoading ? (
          <>
            <Text fontSize="13px" color="fg.muted">
              Загружаем вакцины и обработки...
            </Text>
            <LoadingRows />
          </>
        ) : backendPetId && eventsQuery.isError ? (
          <Box bg="red.950" color="red.100" rounded="lg" p="16px" minH="76px">
            <Text fontWeight={600} fontSize="14px">
              Не удалось загрузить вакцины и обработки
            </Text>
            <Text fontSize="12px" mt="4px">
              {errorDetail}
            </Text>
          </Box>
        ) : items.length === 0 ? (
          <Box bg="secondary.700" rounded="lg" p="16px" minH="76px">
            <Text fontSize="14px" color="fg.muted">
              Нет будущих вакцин и обработок
            </Text>
          </Box>
        ) : (
          items.map((item) => <EventRow key={item.id} item={item} />)
        )}
      </Stack>
    </Card>
  );
}
