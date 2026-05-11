import type { ReactNode } from "react";
import { Box, Container, HStack, IconButton } from "@chakra-ui/react";
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
    <Box minH="100vh" bg="bg.canvas">
      {showHeader && (
        <Box
          as="header"
          borderBottomWidth="1px"
          borderColor="border.subtle"
          position="sticky"
          top={0}
          zIndex={10}
          bg="bg.canvas/80"
          backdropFilter="blur(12px)"
        >
          <HStack
            maxW="1280px"
            mx="auto"
            px={{ base: 4, md: 6 }}
            py={3}
            gap={3}
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
      <Container
        maxW="container.md"
        px={{ base: 4, md: 6 }}
        py={{ base: 8, md: 12 }}
      >
        {children}
      </Container>
    </Box>
  );
}
