import {
  Box,
  HStack,
  Heading,
  Icon,
  IconButton,
  Stack,
  Text,
} from "@chakra-ui/react";
import { LuCalendar, LuClock, LuMapPin, LuPenLine, LuPlus, LuSearch } from "react-icons/lu";
import { PrimaryButton } from "@/components/ui/Buttons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TextField } from "@/components/ui/TextField";
import type { TPetEvent, TPetEventType } from "@/store/pets";

const TYPE_TONE: Record<TPetEventType, "info" | "purple" | "teal" | "warning"> = {
  visit: "info",
  vaccine: "purple",
  treatment: "teal",
  operation: "warning",
};
const TYPE_LABEL: Record<TPetEventType, string> = {
  visit: "Визит",
  vaccine: "Вакцинация",
  treatment: "Обработка",
  operation: "Операция",
};

const RU_MONTH = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

function groupByMonth(events: TPetEvent[]) {
  const sorted = [...events].sort((a, b) => (a.date < b.date ? 1 : -1));
  const groups = new Map<string, TPetEvent[]>();
  for (const e of sorted) {
    const d = new Date(e.date);
    const key = `${RU_MONTH[d.getMonth()]} ${d.getFullYear()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  return Array.from(groups.entries());
}

type TEventRowProps = {
  event: TPetEvent;
};

function EventRow({ event }: TEventRowProps) {
  const d = new Date(event.date);
  return (
    <HStack
      align="flex-start"
      gap="16px"
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.subtle"
      rounded="card"
      p="16px"
    >
      <Stack
        align="center"
        justify="center"
        minW="56px"
        bg="secondary.700"
        rounded="lg"
        px="12px"
        py="8px"
      >
        <Text fontSize="12px" textTransform="uppercase" color="fg.muted" letterSpacing="0.08em">
          {RU_MONTH[d.getMonth()].slice(0, 3)}
        </Text>
        <Text fontSize="24px" fontWeight={700} lineHeight={1}>
          {d.getDate()}
        </Text>
      </Stack>
      <Stack flex={1} gap="4px">
        <HStack justify="space-between" align="flex-start" flexWrap="wrap" gap="8px">
          <Text fontWeight={600}>{event.title}</Text>
          <StatusBadge tone={TYPE_TONE[event.type]}>
            {TYPE_LABEL[event.type]}
          </StatusBadge>
        </HStack>
        <HStack gap="16px" fontSize="14px" color="fg.muted" flexWrap="wrap">
          {event.time && (
            <HStack gap="4px">
              <LuClock />
              <Text>{event.time}</Text>
            </HStack>
          )}
          {event.place && (
            <HStack gap="4px">
              <LuMapPin />
              <Text>{event.place}</Text>
            </HStack>
          )}
        </HStack>
        {event.comment && (
          <Text fontSize="14px" color="fg.subtle">
            {event.comment}
          </Text>
        )}
      </Stack>
      <IconButton
        aria-label="Редактировать"
        size="xs"
        variant="ghost"
        color="fg.muted"
      >
        <LuPenLine />
      </IconButton>
    </HStack>
  );
}

type TEventsTabProps = {
  events: TPetEvent[];
};

export function EventsTab({ events }: TEventsTabProps) {
  const groups = groupByMonth(events);
  return (
    <Stack gap="24px">
      <HStack justify="space-between" flexWrap="wrap" gap="12px">
        <Stack gap="4px">
          <Heading size="lg">Лента событий</Heading>
          <Text color="fg.muted" fontSize="14px">
            Будущие и прошедшие события по питомцу
          </Text>
        </Stack>
        <PrimaryButton h="44px" px="20px">
          <HStack gap="8px">
            <LuPlus />
            <Text>Добавить событие</Text>
          </HStack>
        </PrimaryButton>
      </HStack>

      <HStack gap="12px" flexWrap={["wrap", null, "nowrap"]}>
        <Box flex={1} minW="220px">
          <TextField
            placeholder="Поиск по названию, заметкам..."
            startElement={<LuSearch />}
            uppercase={false}
          />
        </Box>
        <Box w={["full", null, "180px"]}>
          <TextField placeholder="Тип: Все" uppercase={false} />
        </Box>
        <Box w={["full", null, "200px"]}>
          <TextField
            placeholder="Период"
            startElement={<LuCalendar />}
            uppercase={false}
          />
        </Box>
      </HStack>

      <Stack gap="24px">
        {groups.map(([month, items]) => (
          <Stack key={month} gap="12px">
            <Text
              fontSize="12px"
              fontWeight={700}
              letterSpacing="0.12em"
              textTransform="uppercase"
              color="fg.muted"
            >
              {month}
            </Text>
            <Stack gap="8px">
              {items.map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </Stack>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}
