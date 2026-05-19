import { Stack, Text } from "@chakra-ui/react";
import type { TReminder } from "@/lib/petsApi";
import { ReminderRow } from "./ReminderRow";
import {
  EmptyRemindersBlock,
  ReminderErrorBlock,
  ReminderLoadingBlock,
} from "./StateBlocks";

export type TRemindersContentProps = {
  authenticated: boolean;
  reminders: TReminder[];
  isLoading: boolean;
  error: unknown;
  onOpenPet: (petId: string) => void;
  showTitle?: boolean;
};

export function RemindersContent({
  authenticated,
  reminders,
  isLoading,
  error,
  onOpenPet,
  showTitle = true,
}: TRemindersContentProps) {
  if (!authenticated) {
    return <EmptyRemindersBlock />;
  }

  return (
    <Stack gap="8px">
      {showTitle && (
        <Text
          fontSize="11px"
          fontWeight={700}
          color="fg.muted"
          textTransform="uppercase"
          letterSpacing="0.08em"
          px="2px"
        >
          Напоминания
        </Text>
      )}
      {isLoading ? (
        <ReminderLoadingBlock />
      ) : error ? (
        <ReminderErrorBlock error={error} />
      ) : reminders.length === 0 ? (
        <EmptyRemindersBlock />
      ) : (
        <Stack gap="4px">
          {reminders.map((reminder) => (
            <ReminderRow
              key={reminder.id}
              reminder={reminder}
              onOpenPet={onOpenPet}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
