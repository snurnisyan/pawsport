import type { ReactNode } from "react";
import { Box, Flex, HStack, IconButton, Text } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { LuBell, LuCalendar, LuHouse, LuMenu } from "react-icons/lu";
import { Logo } from "@/components/ui/Logo";
import { ChakraLink } from "@/components/ui/NextLink";

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
      fontWeight={500}
      color={active ? "fg.accent" : "fg.muted"}
      bg={active ? "secondary.700" : "transparent"}
      _hover={{ color: "fg.accent", bg: "secondary.700" }}
      transition="all 0.15s"
    >
      <Box fontSize="16px">{item.icon}</Box>
      <Text display={{ base: "none", sm: "block" }}>{item.label}</Text>
    </ChakraLink>
  );
}

type THeaderProps = {
  userEmail?: string;
};

export function Header({ userEmail = "user@test.ru" }: THeaderProps) {
  const router = useRouter();
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
        <Flex gap="32px">
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

        <HStack gap="12px">
          <IconButton
            aria-label="Уведомления"
            variant="ghost"
            size="sm"
            color="fg.muted"
            _hover={{ color: "fg.default", bg: "secondary.700" }}
          >
            <LuBell />
          </IconButton>
          <Text
            fontSize="14px"
            color="fg.muted"
            display={{ base: "none", sm: "block" }}
          >
            {userEmail}
          </Text>
          <IconButton
            aria-label="Меню"
            variant="ghost"
            size="sm"
            color="fg.muted"
            display={{ base: "inline-flex", md: "none" }}
          >
            <LuMenu />
          </IconButton>
        </HStack>
      </Flex>
      <Flex
        gap="8px"
        px="16px"
        pb="12px"
        display={{ base: "flex", md: "none" }}
        overflowX="auto"
      >
        {NAV.map((item) => (
          <NavTab
            key={item.href}
            item={item}
            active={router.pathname.startsWith(item.href)}
          />
        ))}
      </Flex>
    </Box>
  );
}
