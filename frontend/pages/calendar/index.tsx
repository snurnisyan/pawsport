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
import { useState } from "react";
import { LuChevronLeft, LuChevronRight, LuFilter } from "react-icons/lu";
import { CalendarFilters } from "@/components/calendar/CalendarFilters";
import { MiniMonth } from "@/components/calendar/MiniMonth";
import { AppWrapper } from "@/components/layout/AppWrapper";
import { GhostButton } from "@/components/ui/Buttons";

const SAMPLE_MARKS: Record<number, Record<number, ("vaccine" | "treatment" | "visit" | "warning")[]>> = {
  0: { 12: ["vaccine"], 14: ["warning"] },
  2: { 14: ["warning"], 22: ["vaccine"] },
  4: { 5: ["warning"], 15: ["visit"], 29: ["treatment"] },
  6: { 18: ["vaccine"] },
  7: { 18: ["treatment"] },
  8: { 2: ["visit"], 15: ["vaccine"], 28: ["treatment"] },
  10: { 11: ["visit"] },
};

export default function CalendarPage() {
  const [year, setYear] = useState(2026);
  const drawer = useDisclosure();

  return (
    <>
      <Head>
        <title>Календарь — PawsPort</title>
      </Head>
      <AppWrapper maxW="1440px">
        <Grid
          templateColumns={{ base: "1fr", lg: "1fr 240px" }}
          gap={{ base: 4, lg: 8 }}
          alignItems="start"
        >
          <Stack gap={5}>
            <HStack justify="space-between">
              <HStack gap={2}>
                <IconButton
                  aria-label="Предыдущий год"
                  variant="ghost"
                  size="sm"
                  color="fg.muted"
                  onClick={() => setYear((y) => y - 1)}
                >
                  <LuChevronLeft />
                </IconButton>
                <Text fontSize="2xl" fontWeight="bold" minW="80px" textAlign="center">
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
                display={{ base: "inline-flex", lg: "none" }}
                onClick={drawer.onOpen}
                h="40px"
                px={4}
              >
                <HStack gap={2}>
                  <LuFilter />
                  <Text>Фильтры</Text>
                </HStack>
              </GhostButton>
            </HStack>

            <Grid
              templateColumns={{ base: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" }}
              gap={4}
            >
              {Array.from({ length: 12 }).map((_, m) => (
                <MiniMonth
                  key={m}
                  year={year}
                  month={m}
                  marks={SAMPLE_MARKS[m] || {}}
                />
              ))}
            </Grid>
          </Stack>

          <Box display={{ base: "none", lg: "block" }} position="sticky" top="80px">
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
      </AppWrapper>
    </>
  );
}
