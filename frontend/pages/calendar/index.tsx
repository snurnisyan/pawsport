import {
  Box,
  Drawer,
  Grid,
  HStack,
  IconButton,
  Stack,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import Head from "next/head";
import { useMemo, useState } from "react";
import { LuChevronLeft, LuChevronRight, LuFilter } from "react-icons/lu";
import { CalendarFilters } from "@/components/calendar/CalendarFilters";
import { MiniMonth } from "@/components/calendar/MiniMonth";
import { DayDialog } from "@/components/calendar/day/DayDialog";
import type { TDayEvent, TDayEventType } from "@/components/calendar/day/DayEventCard";
import { AppWrapper } from "@/components/layout/AppWrapper";
import { GhostButton } from "@/components/ui/Buttons";
import { usePetsStore, type TPet } from "@/store/pets";

type TMark = "vaccine" | "treatment" | "visit" | "warning";

const SAMPLE_MARKS: Record<number, Record<number, TMark[]>> = {
  0: { 12: ["vaccine"], 14: ["warning"] },
  2: { 14: ["warning"], 22: ["vaccine"] },
  4: { 5: ["warning"], 15: ["visit"], 29: ["treatment"] },
  6: { 18: ["vaccine"] },
  7: { 18: ["treatment"] },
  8: { 2: ["visit", "vaccine", "treatment"], 15: ["vaccine"], 28: ["treatment"] },
  10: { 11: ["visit"] },
};

const MARK_TO_EVENT: Record<TMark, { type: TDayEventType; title: string }> = {
  vaccine: { type: "vaccine", title: "Вакцинация (бешенство)" },
  treatment: { type: "treatment", title: "Обработка от паразитов" },
  visit: { type: "visit", title: "Чек-ап" },
  warning: { type: "operation", title: "Просроченная вакцинация" },
};

const TIMES = ["09:00", "10:30", "14:00", "16:30"];

const SEX_LABEL: Record<TPet["sex"], string> = { male: "мальчик", female: "девочка" };
const SPECIES_LABEL: Record<TPet["species"], string> = {
  dog: "собака",
  cat: "кот",
  other: "питомец",
};

const petDescription = (pet: TPet) =>
  `${pet.name}, ${SPECIES_LABEL[pet.species]} (${SEX_LABEL[pet.sex]}, ${pet.ageLabel})`;

const buildSampleEvents = (marks: TMark[], pets: TPet[]): TDayEvent[] => {
  if (pets.length === 0) return [];
  return marks.map((mark, idx) => {
    const meta = MARK_TO_EVENT[mark];
    const pet = pets[idx % pets.length];
    return {
      id: `${mark}-${idx}`,
      type: meta.type,
      title: meta.title,
      time: TIMES[idx % TIMES.length],
      petId: pet.id,
      petName: pet.name,
      petDescription: petDescription(pet),
      place: "Ветеринарная клиника",
      nextDate: mark === "vaccine" ? "2027-06-12" : undefined,
      reminder: "1d",
      comment:
        mark === "vaccine"
          ? "Вакцинация от бешенства, нужно прийти натощак"
          : undefined,
      files:
        idx === 1
          ? [{ name: "Направление.pdf" }, { name: "Анализы.pdf" }]
          : undefined,
    };
  });
};

type TSelectedDay = { year: number; month: number; day: number };

export default function CalendarPage() {
  const [year, setYear] = useState(2026);
  const [selectedDay, setSelectedDay] = useState<TSelectedDay | null>(null);
  const drawer = useDisclosure();
  const pets = usePetsStore((s) => s.pets);

  const petOptions = useMemo(
    () => pets.map((p) => ({ value: p.id, label: p.name })),
    [pets],
  );

  const dayEvents = selectedDay
    ? buildSampleEvents(
        SAMPLE_MARKS[selectedDay.month]?.[selectedDay.day] ?? [],
        pets,
      )
    : [];
  const dayDate = selectedDay
    ? new Date(selectedDay.year, selectedDay.month, selectedDay.day)
    : new Date();

  return (
    <>
      <Head>
        <title>Календарь — PawsPort</title>
      </Head>
      <AppWrapper maxW="1440px">
        <Grid
          templateColumns={["1fr", null, null, "1fr 240px"]}
          gap={["16px", null, null, "32px"]}
          alignItems="start"
        >
          <Stack gap="20px">
            <HStack justify="space-between">
              <HStack gap="8px">
                <IconButton
                  aria-label="Предыдущий год"
                  variant="ghost"
                  size="sm"
                  color="fg.muted"
                  onClick={() => setYear((y) => y - 1)}
                >
                  <LuChevronLeft />
                </IconButton>
                <Text fontSize="24px" fontWeight={700} minW="80px" textAlign="center">
                  {year}
                </Text>
                <IconButton
                  aria-label="Следующий год"
                  variant="ghost"
                  size="sm"
                  color="fg.muted"
                  onClick={() => setYear((y) => y + 1)}
                >
                  <LuChevronRight />
                </IconButton>
              </HStack>
              <GhostButton
                display={["inline-flex", null, null, "none"]}
                onClick={drawer.onOpen}
                h="40px"
                px="16px"
              >
                <HStack gap="8px">
                  <LuFilter />
                  <Text>Фильтры</Text>
                </HStack>
              </GhostButton>
            </HStack>

            <Grid
              templateColumns={["1fr", "1fr 1fr", "repeat(3, 1fr)"]}
              gap="16px"
            >
              {Array.from({ length: 12 }).map((_, m) => (
                <MiniMonth
                  key={m}
                  year={year}
                  month={m}
                  marks={SAMPLE_MARKS[m] || {}}
                  onDayClick={(day) => setSelectedDay({ year, month: m, day })}
                />
              ))}
            </Grid>
          </Stack>

          <Box display={["none", null, null, "block"]} position="sticky" top="80px">
            <CalendarFilters />
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
              <Drawer.Header>
                <Drawer.Title>Фильтры</Drawer.Title>
              </Drawer.Header>
              <Drawer.Body>
                <CalendarFilters />
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
        />
      </AppWrapper>
    </>
  );
}
