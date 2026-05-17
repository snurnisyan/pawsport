import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Box,
  Flex,
  IconButton,
  Popover,
  Portal,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { LuBell, LuCalendar, LuChevronDown, LuHouse, LuLogOut, LuMenu } from "react-icons/lu";
import { Logo } from "@/components/ui/Logo";
import { ChakraLink } from "@/components/ui/NextLink";
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
import { clearAuthSession, useAuthSession } from "@/lib/session";

type TNavItem = {
  label: string;
  href: string;
  icon: ReactNode;
};

const NAV: TNavItem[] = [
  { label: "Мои питомцы", href: "/pets", icon: <LuHouse /> },
  { label: "Календарь", href: "/calendar", icon: <LuCalendar /> },
];

type TNavTabProps = {
  item: TNavItem;
  active: boolean;
};

function NavTab({ item, active }: TNavTabProps) {
  return (
    <ChakraLink
      href={item.href}
      display="inline-flex"
      alignItems="center"
      gap="8px"
      px="16px"
      py="8px"
      rounded="12px"
      fontSize="14px"
      fontWeight={600}
      color={active ? "fg.accent" : "fg.muted"}
      bg={active ? "secondary.700" : "transparent"}
      _hover={{ color: "fg.accent", bg: "secondary.700" }}
      transition="all 0.15s"
    >
      <Box fontSize="16px">{item.icon}</Box>
      <Text display={["none", "block"]}>{item.label}</Text>
    </ChakraLink>
  );
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

function ReminderRow({ reminder }: { reminder: TReminder }) {
  const meta = reminder.event ? EVENT_TYPE_META[reminder.event.type] : undefined;
  const Icon = meta?.Icon ?? LuBell;
  const isUnread = !reminder.readAt;
  const eventDate = reminder.event?.eventDate ?? reminder.dueAt;

  return (
    <Box
      display="flex"
      alignItems="center"
      gap="10px"
      w="full"
      minH="62px"
      px="10px"
      py="8px"
      rounded="md"
      color="fg.default"
      cursor="default"
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
    </Box>
  );
}

type TRemindersContentProps = {
  authenticated: boolean;
  reminders: TReminder[];
  isLoading: boolean;
  error: unknown;
  showTitle?: boolean;
};

function RemindersContent({
  authenticated,
  reminders,
  isLoading,
  error,
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
            <ReminderRow key={reminder.id} reminder={reminder} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

type TLogoutRowProps = {
  onClick: () => void;
};

function LogoutRow({ onClick }: TLogoutRowProps) {
  return (
    <Pressable
      type="button"
      onClick={onClick}
      display="flex"
      alignItems="center"
      gap="10px"
      w="full"
      px="12px"
      py="10px"
      rounded="md"
      color="fg.default"
      cursor="pointer"
      _hover={{ bg: "secondary.700" }}
    >
      <Box color="fg.muted" fontSize="16px">
        <LuLogOut />
      </Box>
      <Text fontSize="14px">Выйти</Text>
    </Pressable>
  );
}

const POPOVER_CONTENT_PROPS = {
  bg: "bg.surface",
  borderColor: "border.subtle",
  borderWidth: "1px",
  rounded: "card",
  shadow: "card",
  p: "12px",
} as const;

type THeaderProps = {
  userEmail?: string;
};

export function Header({ userEmail = "user@test.ru" }: THeaderProps) {
  const router = useRouter();
  const session = useAuthSession();
  const queryClient = useQueryClient();
  const [desktopRemindersOpen, setDesktopRemindersOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const email = session?.user.email ?? userEmail;
  const remindersQuery = useQuery({
    queryKey: ACTIVE_REMINDERS_QUERY_KEY,
    queryFn: listActiveReminders,
    enabled: Boolean(session?.accessToken),
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
  const remindersOpen = desktopRemindersOpen || mobileMenuOpen;

  useEffect(() => {
    if (
      !remindersOpen ||
      !remindersQuery.isSuccess ||
      unreadReminderIds.length === 0 ||
      markReadPending
    ) {
      return;
    }

    markRead(unreadReminderIds);
  }, [
    remindersOpen,
    remindersQuery.isSuccess,
    unreadReminderIds,
    markRead,
    markReadPending,
  ]);

  const logout = () => {
    clearAuthSession();
    router.push("/auth/login");
  };

  return (
    <Box
      as="header"
      position="sticky"
      top="0"
      zIndex={10}
      bg="bg.canvas/80"
      backdropFilter="blur(12px)"
      borderBottomWidth="1px"
      borderColor="border.subtle"
      px="24px"
    >
      <Flex
        align="center"
        justify="space-between"
        py="18px"
        gap="16px"
      >
        <Flex gap={["20px", "20px", "32px"]}>
          <Logo />
          <Flex gap="4px">
            {NAV.map((item) => (
              <NavTab
                key={item.href}
                item={item}
                active={router.pathname.startsWith(item.href)}
              />
            ))}
          </Flex>
        </Flex>

        <Flex gap="12px" alignItems="center">
          <Popover.Root
            positioning={{ placement: "bottom-end" }}
            open={desktopRemindersOpen}
            onOpenChange={(details) => setDesktopRemindersOpen(details.open)}
          >
            <Popover.Trigger asChild>
              <IconButton
                display={["none", "none", "flex"]}
                aria-label={
                  hasUnreadReminders
                    ? "Уведомления, есть непрочитанные"
                    : "Уведомления"
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
                    authenticated={Boolean(session?.accessToken)}
                    reminders={reminders}
                    isLoading={remindersQuery.isLoading}
                    error={remindersQuery.error}
                  />
                </Popover.Content>
              </Popover.Positioner>
            </Portal>
          </Popover.Root>

          <Popover.Root positioning={{ placement: "bottom-end" }}>
            <Popover.Trigger asChild>
              <Pressable
                type="button"
                display={["none", "none", "flex"]}
                alignItems="center"
                gap="6px"
                h="32px"
                px="10px"
                rounded="md"
                color="fg.muted"
                cursor="pointer"
                _hover={{ color: "fg.default", bg: "secondary.700" }}
              >
                <Text fontSize="14px">{email}</Text>
                <Box fontSize="14px">
                  <LuChevronDown />
                </Box>
              </Pressable>
            </Popover.Trigger>
            <Portal>
              <Popover.Positioner>
                <Popover.Content {...POPOVER_CONTENT_PROPS} minW="auto" w="140px">
                  <LogoutRow onClick={logout} />
                </Popover.Content>
              </Popover.Positioner>
            </Portal>
          </Popover.Root>

          <Popover.Root
            positioning={{ placement: "bottom-end" }}
            open={mobileMenuOpen}
            onOpenChange={(details) => setMobileMenuOpen(details.open)}
          >
            <Popover.Trigger asChild>
              <IconButton
                aria-label="Меню"
                variant="ghost"
                size="sm"
                color="fg.muted"
                display={["inline-flex", null, "none"]}
              >
                <LuMenu />
              </IconButton>
            </Popover.Trigger>
            <Portal>
              <Popover.Positioner>
                <Popover.Content {...POPOVER_CONTENT_PROPS} minW="240px">
                  <Stack gap="4px">
                    <Text
                      fontSize="11px"
                      fontWeight={700}
                      color="fg.muted"
                      textTransform="uppercase"
                      letterSpacing="0.08em"
                      px="12px"
                      pt="4px"
                    >
                      Напоминания
                      {hasUnreadReminders && (
                        <Box
                          as="span"
                          aria-hidden="true"
                          display="inline-block"
                          boxSize="7px"
                          rounded="full"
                          bg="red.500"
                          ms="8px"
                          verticalAlign="middle"
                        />
                      )}
                    </Text>
                    <RemindersContent
                      authenticated={Boolean(session?.accessToken)}
                      reminders={reminders}
                      isLoading={remindersQuery.isLoading}
                      error={remindersQuery.error}
                      showTitle={false}
                    />
                    <Box h="1px" bg="border.subtle" my="4px" />
                    <LogoutRow onClick={logout} />
                  </Stack>
                </Popover.Content>
              </Popover.Positioner>
            </Portal>
          </Popover.Root>
        </Flex>
      </Flex>
    </Box>
  );
}
