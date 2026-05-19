import { useState } from "react";
import { Box, Popover, Portal } from "@chakra-ui/react";
import { Pressable } from "@/components/ui/Pressable";
import { EVENT_TYPE_META } from "@/lib/eventTypes";
import { DayPopup } from "./DayPopup";
import type { TDayMark, TMiniDayEvent } from "./types";

type TDayCellProps = {
  day: number;
  isToday: boolean;
  dayMarks: TDayMark[];
  events?: TMiniDayEvent[];
  onClick: () => void;
  onExpand: () => void;
};

export function DayCell({ day, isToday, dayMarks, events, onClick, onExpand }: TDayCellProps) {
  const hasEvents = !!events && events.length > 0;
  const [open, setOpen] = useState(false);
  const cell = (
    <Pressable
      type="button"
      onClick={hasEvents ? undefined : onClick}
      position="relative"
      aspectRatio={[1, 1, 0.7, 0.7, 1]}
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
            <Box key={idx} w="6px" h="6px" rounded="full" bg={EVENT_TYPE_META[m].color} />
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
