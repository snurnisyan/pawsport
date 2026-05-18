import { useEffect, useMemo, useState } from "react";
import { Box, Flex, IconButton, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { LuBell } from "react-icons/lu";
import { Pressable } from "@/components/ui/Pressable";
import { toaster } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api";
import { EVENT_TYPE_META } from "@/lib/eventTypes";
import {
  listActiveReminders,
  markRemindersRead,
  remindersQueryKey,
  type TReminder,
  type TReminderListResponse,
} from "@/lib/petsApi";
import { useAuthSession } from "@/lib/session";
import { usePetNavigationStore } from "@/store/petNavigation";
import { POPOVER_CONTENT_PROPS } from "./popoverStyles";

const ACTIVE_REMINDER_FILTERS = { activeOnly: "true" } as const;
const ACTIVE_REMINDERS_QUERY_KEY = remindersQueryKey(ACTIVE_REMINDER_FILTERS);
const EMPTY_REMINDERS: TReminder[] = [];

const formatEventDate = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export type TUseRemindersResult = {
  authenticated: boolean;
  reminders: TReminder[];
  isLoading: boolean;
  error: unknown;
  hasUnreadReminders: boolean;
};

export function useReminders(open: boolean): TUseRemindersResult {
  const session = useAuthSession();
  const queryClient = useQueryClient();
  const authenticated = Boolean(session?.accessToken);

  const remindersQuery = useQuery({
    queryKey: ACTIVE_REMINDERS_QUERY_KEY,
    queryFn: listActiveReminders,
    enabled: authenticated,
    staleTime: 60_000,
  });
  const reminders = remindersQuery.data?.items ?? EMPTY_REMINDERS;
  const unreadReminderIds = useMemo(
    () => reminders.filter((reminder) => !reminder.readAt).map((reminder) => reminder.id),
    [reminders]
  );
  const hasUnreadReminders = unreadReminderIds.length > 0;

  const markReadMutation = useMutation({
    mutationFn: markRemindersRead,
    onSuccess: (response) => {
      const readById = new Map(response.items.map((item) => [item.id, item.readAt]));
      queryClient.setQueryData<TReminderListResponse>(
        ACTIVE_REMINDERS_QUERY_KEY,
        (current) => {
          if (!current) return current;
          return {
            items: current.items.map((reminder) => {
              const readAt = readById.get(reminder.id);
              return readAt ? { ...reminder, readAt } : reminder;
            }),
          };
        }
      );
    },
    onError: (error) => {
      toaster.error({
        title: "Не удалось отметить напоминания",
        description:
          error instanceof ApiError
            ? error.message
            : "Попробуйте открыть напоминания еще раз.",
      });
    },
  });
  const markRead = markReadMutation.mutate;
  const markReadPending = markReadMutation.isPending;

  useEffect(() => {
    if (
      !open ||
      !remindersQuery.isSuccess ||
      unreadReminderIds.length === 0 ||
      markReadPending
    ) {
      return;
    }

    markRead(unreadReminderIds);
  }, [
    open,
    remindersQuery.isSuccess,
    unreadReminderIds,
    markRead,
    markReadPending,
  ]);

  return {
    authenticated,
    reminders,
    isLoading: remindersQuery.isLoading,
    error: remindersQuery.error,
    hasUnreadReminders,
  };
}

function EmptyRemindersBlock() {
  return (
    <Stack align="center" gap="6px" py="12px">
      <Box color="fg.muted" fontSize="20px">
        <LuBell />
      </Box>
      <Text fontSize="13px" color="fg.muted">
        Нет напоминаний
      </Text>
    </Stack>
  );
}

function ReminderLoadingBlock() {
  return (
    <Stack gap="6px" py="12px">
      <Text fontSize="13px" color="fg.muted">
        Загружаем напоминания...
      </Text>
    </Stack>
  );
}

function ReminderErrorBlock({ error }: { error: unknown }) {
  const detail =
    error instanceof ApiError && error.message
      ? error.message
      : "Попробуйте обновить страницу.";

  return (
    <Stack gap="4px" py="8px">
      <Text fontSize="13px" fontWeight={700} color="red.200">
        Не удалось загрузить напоминания
      </Text>
      <Text fontSize="12px" color="fg.muted">
        {detail}
      </Text>
    </Stack>
  );
}

type TReminderRowProps = {
  reminder: TReminder;
  onOpenPet: (petId: string) => void;
};

function ReminderRow({ reminder, onOpenPet }: TReminderRowProps) {
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
        {formatEventDate(eventDate)}
      </Text>
    </Pressable>
  );
}

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

export function useOpenReminderPet(onClose: () => void) {
  const router = useRouter();
  const setPetTab = usePetNavigationStore((s) => s.setPetTab);
  return (petId: string) => {
    setPetTab(petId, "events");
    onClose();
    void router.push(`/pets/${petId}`);
  };
}

export function RemindersPopover() {
  const [open, setOpen] = useState(false);
  const { authenticated, reminders, isLoading, error, hasUnreadReminders } =
    useReminders(open);
  const onOpenPet = useOpenReminderPet(() => setOpen(false));

  return (
    <Popover.Root
      positioning={{ placement: "bottom-end" }}
      open={open}
      onOpenChange={(details) => setOpen(details.open)}
    >
      <Popover.Trigger asChild>
        <IconButton
          display={["none", "none", "flex"]}
          aria-label={
            hasUnreadReminders ? "Уведомления, есть непрочитанные" : "Уведомления"
          }
          variant="ghost"
          size="sm"
          color="fg.muted"
          position="relative"
          _hover={{ color: "fg.default", bg: "secondary.700" }}
        >
          <LuBell />
          {hasUnreadReminders && (
            <Box
              aria-hidden="true"
              position="absolute"
              top="6px"
              right="6px"
              boxSize="8px"
              rounded="full"
              bg="red.500"
              borderWidth="1px"
              borderColor="bg.canvas"
            />
          )}
        </IconButton>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content {...POPOVER_CONTENT_PROPS} w="320px" maxW="calc(100vw - 32px)">
            <RemindersContent
              authenticated={authenticated}
              reminders={reminders}
              isLoading={isLoading}
              error={error}
              onOpenPet={onOpenPet}
            />
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
