import { useState } from "react";
import { Box, Grid, HStack, IconButton, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import { LuSquareArrowOutUpRight } from "react-icons/lu";
import { Pressable } from "@/components/ui/Pressable";

const RU_MONTH_FULL = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

type TDayMark = "vaccine" | "treatment" | "visit";

const MARK_COLOR: Record<TDayMark, string> = {
  vaccine: "#A855F7",
  treatment: "#10B981",
  visit: "#3B82F6",
};

export type TMiniDayEvent = {
  mark: TDayMark;
  title: string;
  petName: string;
  time: string;
};

type TMiniMonthProps = {
  year: number;
  month: number;
  marks?: Record<number, TDayMark[]>;
  eventsByDay?: Record<number, TMiniDayEvent[]>;
  onDayClick?: (day: number) => void;
  onDayExpand?: (day: number) => void;
};

type TDayPopupProps = {
  events: TMiniDayEvent[];
  onExpand: () => void;
};

function DayPopup({ events, onExpand }: TDayPopupProps) {
  return (
    <Stack gap="10px" minW="260px">
      <Stack gap="8px">
        {events.map((event, idx) => (
          <HStack key={idx} gap="10px" justify="space-between">
            <HStack gap="10px" minW={0}>
              <Box
                w="8px"
                h="8px"
                rounded="full"
                bg={MARK_COLOR[event.mark]}
                flexShrink={0}
              />
              <Text fontSize="14px" color="fg.default" truncate>
                {event.title} ({event.petName})
              </Text>
            </HStack>
            <Text fontSize="13px" color="fg.muted" flexShrink={0}>
              {event.time}
            </Text>
          </HStack>
        ))}
      </Stack>
      <HStack justify="flex-end" pt="4px" borderTopWidth="1px" borderColor="border.subtle">
        <IconButton
          aria-label="Развернуть"
          size="sm"
          variant="ghost"
          color="fg.muted"
          onClick={onExpand}
          _hover={{ color: "fg.default", bg: "secondary.700" }}
        >
          <LuSquareArrowOutUpRight />
        </IconButton>
      </HStack>
    </Stack>
  );
}

type TDayCellProps = {
  day: number;
  isToday: boolean;
  dayMarks: TDayMark[];
  events?: TMiniDayEvent[];
  onClick: () => void;
  onExpand: () => void;
};

function DayCell({ day, isToday, dayMarks, events, onClick, onExpand }: TDayCellProps) {
  const hasEvents = !!events && events.length > 0;
  const [open, setOpen] = useState(false);
  const cell = (
    <Pressable
      type="button"
      onClick={hasEvents ? undefined : onClick}
      position="relative"
      aspectRatio={1}
      rounded="md"
      fontSize="12px"
      color={isToday ? "white" : "fg.subtle"}
      bg={isToday ? "primary.500" : "transparent"}
      fontWeight={isToday ? 700 : 500}
      cursor="pointer"
      _hover={!isToday ? { bg: "secondary.700" } : undefined}
      display="flex"
      alignItems="center"
      justifyContent="center"
      w="full"
    >
      {day}
      {dayMarks.length > 0 && (
        <Box position="absolute" bottom="3px" display="flex" gap="2px">
          {dayMarks.slice(0, 3).map((m, idx) => (
            <Box key={idx} w="6px" h="6px" rounded="full" bg={MARK_COLOR[m]} />
          ))}
        </Box>
      )}
    </Pressable>
  );

  if (!hasEvents) {
    return cell;
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(d) => setOpen(d.open)}
      positioning={{ placement: "bottom" }}
      lazyMount
      unmountOnExit
    >
      <Popover.Trigger asChild>{cell}</Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            bg="bg.surface"
            borderColor="border.subtle"
            borderWidth="1px"
            rounded="card"
            shadow="card"
            p="14px"
          >
            <DayPopup
              events={events}
              onExpand={() => {
                setOpen(false);
                requestAnimationFrame(onExpand);
              }}
            />
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}

export function MiniMonth({
  year,
  month,
  marks = {},
  eventsByDay = {},
  onDayClick,
  onDayExpand,
}: TMiniMonthProps) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() === month;

  return (
    <Box
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.subtle"
      rounded="card"
      p="16px"
    >
      <Stack gap="12px">
        <Text
          fontSize="12px"
          fontWeight={700}
          letterSpacing="0.12em"
          textTransform="uppercase"
          color="fg.muted"
          textAlign="center"
        >
          {RU_MONTH_FULL[month]}
        </Text>
        <Grid templateColumns="repeat(7, 1fr)" gap="4px">
          {WEEKDAYS.map((d) => (
            <Text
              key={d}
              fontSize="10px"
              color="fg.muted"
              textAlign="center"
              py="4px"
            >
              {d}
            </Text>
          ))}
          {Array.from({ length: offset }).map((_, i) => (
            <Box key={`pad-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const isToday = isCurrentMonth && today.getDate() === day;
            const dayMarks = marks[day] || [];
            const events = eventsByDay[day];
            return (
              <DayCell
                key={day}
                day={day}
                isToday={isToday}
                dayMarks={dayMarks}
                events={events}
                onClick={() => onDayClick?.(day)}
                onExpand={() => onDayExpand?.(day)}
              />
            );
          })}
        </Grid>
      </Stack>
    </Box>
  );
}
