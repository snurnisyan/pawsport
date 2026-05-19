import { Box, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { LuSquareArrowOutUpRight } from "react-icons/lu";
import { EVENT_TYPE_META } from "@/lib/eventTypes";
import type { TMiniDayEvent } from "./types";

type TDayPopupProps = {
  events: TMiniDayEvent[];
  onExpand: () => void;
};

export function DayPopup({ events, onExpand }: TDayPopupProps) {
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
                bg={EVENT_TYPE_META[event.mark].color}
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
