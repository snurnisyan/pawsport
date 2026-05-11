import type { ReactNode } from "react";
import { Box, Flex, HStack, IconButton } from "@chakra-ui/react";
import { LuArrowLeft } from "react-icons/lu";
import { Logo } from "@/components/ui/Logo";

type TAuthLayoutProps = {
  children: ReactNode;
  showHeader?: boolean;
  onBack?: () => void;
};

export function AuthLayout({ children,
                             showHeader = false,
                             onBack }: TAuthLayoutProps) {
  return (
    <Flex direction="column" minH="100vh" w="100%" bg="bg.canvas">
      {showHeader && (
        <Box
          as="header"
          borderBottomWidth="1px"
          borderColor="border.subtle"
          position="sticky"
          top="0"
          zIndex={10}
          bg="bg.canvas/80"
          backdropFilter="blur(12px)"
          w="100%"
        >
          <HStack
            maxW="1280px"
            mx="auto"
            px={{ base: "16px", md: "24px" }}
            py="12px"
            gap="12px"
          >
            {onBack && (
              <IconButton
                aria-label="Назад"
                variant="ghost"
                size="sm"
                color="primary.400"
                onClick={onBack}
              >
                <LuArrowLeft />
              </IconButton>
            )}
            <Logo size="sm" />
          </HStack>
        </Box>
      )}
      <Flex
        flex="1"
        w="100%"
        align="center"
        justify="center"
        px={{ base: "16px", md: "24px" }}
        py={{ base: "32px", md: "48px" }}
      >
        <Box w="100%" maxW="640px">
          {children}
        </Box>
      </Flex>
    </Flex>
  );
}
