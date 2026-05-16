import { HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { LuClock, LuMapPin, LuPenLine } from "react-icons/lu";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { TPetEvent } from "@/store/pets";
import { RU_MONTH_SHORT, TYPE_LABEL, TYPE_TONE } from "./eventsShared";

type TEventRowProps = {
  event: TPetEvent;
  onEdit: (event: TPetEvent) => void;
};

export function EventRow({ event, onEdit }: TEventRowProps) {
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
          {RU_MONTH_SHORT[d.getMonth()]}
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
        onClick={() => onEdit(event)}
        _hover={{ color: "fg.default", bg: "secondary.700" }}
      >
        <LuPenLine />
      </IconButton>
    </HStack>
  );
}
