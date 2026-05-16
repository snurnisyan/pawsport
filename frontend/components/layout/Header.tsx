import type { ReactNode } from "react";
import {
  Box,
  Flex,
  IconButton,
  Popover,
  Portal,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { LuBell, LuCalendar, LuChevronDown, LuHouse, LuLogOut, LuMenu } from "react-icons/lu";
import { Logo } from "@/components/ui/Logo";
import { ChakraLink } from "@/components/ui/NextLink";
import { Pressable } from "@/components/ui/Pressable";
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
  const email = session?.user.email ?? userEmail;
  const logout = () => {
    clearAuthSession();
    router.push("/auth");
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
          <Popover.Root positioning={{ placement: "bottom-end" }}>
            <Popover.Trigger asChild>
              <IconButton
                display={["none", "none", "flex"]}
                aria-label="Уведомления"
                variant="ghost"
                size="sm"
                color="fg.muted"
                _hover={{ color: "fg.default", bg: "secondary.700" }}
              >
                <LuBell />
              </IconButton>
            </Popover.Trigger>
            <Portal>
              <Popover.Positioner>
                <Popover.Content {...POPOVER_CONTENT_PROPS} minW="240px">
                  <EmptyRemindersBlock />
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

          <Popover.Root positioning={{ placement: "bottom-end" }}>
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
                    </Text>
                    <EmptyRemindersBlock />
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
