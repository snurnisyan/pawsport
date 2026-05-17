import {Flex, HStack, IconButton, Stack, Text} from "@chakra-ui/react";
import { LuClock, LuMapPin, LuPenLine, LuTrash } from "react-icons/lu";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { TPetEvent } from "@/lib/petsApi";
import {RU_MONTH_SHORT, TYPE_BG, TYPE_COLOR, TYPE_LABEL} from "./eventsShared";

type TEventRowProps = {
  event: TPetEvent;
  onEdit: (event: TPetEvent) => void;
  onDelete: (event: TPetEvent) => void;
};

const formatTime = (date: Date): string =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

export function EventRow({ event, onEdit, onDelete }: TEventRowProps) {
  const d = new Date(event.eventDate);
  const time = formatTime(d);
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
          <StatusBadge styleColors={{ bg: TYPE_BG[event.type], color: TYPE_COLOR[event.type] }}>
            <Text whiteSpace={"normal"} width={["min-content", "min-content", "fit-content"]}>
              {TYPE_LABEL[event.type]}
            </Text>
          </StatusBadge>
        </HStack>
        <Flex justifyContent="space-between" alignItems="center" gap={"24px"}>
          <HStack gap="16px" fontSize="14px" color="fg.muted" flexWrap="wrap">
            <HStack gap="4px">
              <LuClock />
              <Text>{time}</Text>
            </HStack>
            {event.clinicName && (
              <HStack gap="4px">
                <LuMapPin />
                <Text>{event.clinicName}</Text>
              </HStack>
            )}
          </HStack>
          {event.comment && (
            <Text fontSize="14px" color="fg.subtle">
              {event.comment}
            </Text>
          )}
          <HStack gap="4px" flexShrink={0}>
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
            <IconButton
              aria-label="Удалить"
              size="xs"
              variant="ghost"
              color="fg.muted"
              onClick={() => onDelete(event)}
              _hover={{ color: "status.danger", bg: "secondary.700" }}
            >
              <LuTrash />
            </IconButton>
          </HStack>
        </Flex>
      </Stack>
    </HStack>
  );
}
