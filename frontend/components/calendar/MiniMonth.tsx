import { Box, Grid, Stack, Text } from "@chakra-ui/react";
import { Pressable } from "@/components/ui/Pressable";

const RU_MONTH_FULL = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

type TDayMark = "vaccine" | "treatment" | "visit" | "warning";

const MARK_COLOR: Record<TDayMark, string> = {
  vaccine: "#A855F7",
  treatment: "#10B981",
  visit: "#3B82F6",
  warning: "#EF4444",
};

type TMiniMonthProps = {
  year: number;
  month: number;
  marks?: Record<number, TDayMark[]>;
  onDayClick?: (day: number) => void;
};

export function MiniMonth({ year, month, marks = {}, onDayClick }: TMiniMonthProps) {
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
            return (
              <Pressable
                key={day}
                type="button"
                onClick={() => onDayClick?.(day)}
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
              >
                {day}
                {dayMarks.length > 0 && (
                  <Box
                    position="absolute"
                    bottom="3px"
                    display="flex"
                    gap="2px"
                  >
                    {dayMarks.slice(0, 3).map((m, idx) => (
                      <Box
                        key={idx}
                        w="6px"
                        h="6px"
                        rounded="full"
                        bg={MARK_COLOR[m]}
                      />
                    ))}
                  </Box>
                )}
              </Pressable>
            );
          })}
        </Grid>
      </Stack>
    </Box>
  );
}
