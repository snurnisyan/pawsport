import { Flex, Stack, Text } from "@chakra-ui/react";
import { LuBell } from "react-icons/lu";
import { Pressable } from "@/components/ui/Pressable";
import { EVENT_TYPE_META } from "@/lib/eventTypes";
import type { TReminder } from "@/lib/petsApi";
import { formatDateWithTime } from "@/utils/dates";

type TReminderRowProps = {
  reminder: TReminder;
  onOpenPet: (petId: string) => void;
};

export function ReminderRow({ reminder, onOpenPet }: TReminderRowProps) {
  const meta = reminder.event ? EVENT_TYPE_META[reminder.event.type] : undefined;
  const Icon = meta?.Icon ?? LuBell;
  const isUnread = !reminder.readAt;
  const eventDate = reminder.event?.eventDate ?? reminder.dueAt;
  const petId = reminder.pet?.id ?? reminder.petId;

  return (
    <Pressable
      type="button"
      onClick={() => onOpenPet(petId)}
      display="flex"
      alignItems="center"
      gap="10px"
      w="full"
      minH="62px"
      px="10px"
      py="8px"
      rounded="md"
      color="fg.default"
      cursor="pointer"
      textAlign="start"
      borderLeftWidth="2px"
      borderLeftColor={isUnread ? "red.500" : "transparent"}
      _hover={{ bg: "secondary.700" }}
    >
      <Flex
        align="center"
        justify="center"
        boxSize="32px"
        rounded="md"
        bg={meta?.bg ?? "secondary.700"}
        color={meta?.color ?? "fg.muted"}
        flexShrink={0}
      >
        <Icon />
      </Flex>
      <Stack gap="2px" minW={0} flex={1}>
        <Text fontSize="13px" fontWeight={700} truncate>
          {reminder.event?.title ?? "Напоминание"}
        </Text>
        <Text fontSize="12px" color="fg.muted" truncate>
          {reminder.pet?.name ?? "Питомец"}
        </Text>
      </Stack>
      <Text
        flexShrink={0}
        fontSize="11px"
        color="fg.muted"
        bg="secondary.700"
        rounded="full"
        px="8px"
        py="3px"
      >
        {formatDateWithTime(eventDate)}
      </Text>
    </Pressable>
  );
}
