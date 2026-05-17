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
import { MiniMonth, type TMiniDayEvent } from "@/components/calendar/MiniMonth";
import { DayDialog } from "@/components/calendar/day/DayDialog";
import type { TDayEvent, TDayEventType } from "@/components/calendar/day/DayEventCard";
import { AppWrapper } from "@/components/layout/AppWrapper";
import { usePetsStore, type TPet } from "@/store/pets";

type TMark = "vaccine" | "treatment" | "visit" | "lab";

const SAMPLE_MARKS: Record<number, Record<number, TMark[]>> = {
  0: { 12: ["vaccine"] },
  2: { 22: ["vaccine"] },
  4: { 15: ["visit"], 29: ["treatment"] },
  6: { 18: ["vaccine"] },
  7: { 18: ["treatment"] },
  8: { 2: ["visit", "vaccine", "treatment"], 15: ["vaccine"], 28: ["treatment"] },
  9: { 6: ["lab"] },
  10: { 11: ["visit"] },
};

const MARK_TO_EVENT: Record<TMark, { type: TDayEventType; title: string }> = {
  vaccine: { type: "vaccine", title: "Вакцинация (бешенство)" },
  treatment: { type: "treatment", title: "Обработка от паразитов" },
  visit: { type: "visit", title: "Чек-ап" },
  lab: { type: "lab", title: "Анализы и обследования" },
};

const TIMES = ["09:00", "10:30", "14:00", "16:30"];

const SEX_LABEL: Record<TPet["sex"], string> = {
  male: "мальчик",
  female: "девочка",
  unknown: "пол не указан",
};
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
      reminder: "day",
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

  const miniEventsByMonth = useMemo(() => {
    const result: Record<number, Record<number, TMiniDayEvent[]>> = {};
    for (const [monthKey, daysMap] of Object.entries(SAMPLE_MARKS)) {
      const monthIdx = Number(monthKey);
      result[monthIdx] = {};
      for (const [dayKey, marks] of Object.entries(daysMap)) {
        const dayIdx = Number(dayKey);
        const events = buildSampleEvents(marks, pets);
        result[monthIdx][dayIdx] = events.map((event, i) => ({
          mark: marks[i],
          title: event.title,
          petName: event.petName,
          time: event.time,
        }));
      }
    }
    return result;
  }, [pets]);

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
                  eventsByDay={miniEventsByMonth[m] || {}}
                  onDayClick={(day) => setSelectedDay({ year, month: m, day })}
                  onDayExpand={(day) => setSelectedDay({ year, month: m, day })}
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
              <Drawer.Header px="20px" py="16px" borderBottomWidth="1px" borderColor="border.subtle">
                <Drawer.Title>Фильтры</Drawer.Title>
              </Drawer.Header>
              <Drawer.Body px="20px" py="20px">
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
