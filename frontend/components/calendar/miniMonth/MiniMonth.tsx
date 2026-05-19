import { Box, Grid, Stack, Text } from "@chakra-ui/react";
import { DayCell } from "./DayCell";
import type { TDayMark, TMiniDayEvent } from "./types";

const RU_MONTH_FULL = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

type TMiniMonthProps = {
  year: number;
  month: number;
  marks?: Record<number, TDayMark[]>;
  eventsByDay?: Record<number, TMiniDayEvent[]>;
  onDayClick?: (day: number) => void;
  onDayExpand?: (day: number) => void;
};

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
