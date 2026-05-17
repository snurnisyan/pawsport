import type { ReactNode } from "react";
import { useEffect } from "react";
import { Box, Container, Spinner, Stack, Text } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useAuthSession, useClientReady } from "@/lib/session";
import { Header } from "./Header";

type TAppWrapperProps = {
  children: ReactNode;
  maxW?: string;
};

export function AppWrapper({ children, maxW = "1024px" }: TAppWrapperProps) {
  const router = useRouter();
  const session = useAuthSession();
  const clientReady = useClientReady();

  useEffect(() => {
    if (clientReady && !session?.accessToken) {
      router.replace("/auth/login");
    }
  }, [clientReady, router, session?.accessToken]);

  if (!clientReady || !session?.accessToken) {
    return (
      <Box
        minH="100vh"
        bg="bg.canvas"
        color="fg.muted"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Stack align="center" gap="12px">
          <Spinner color="primary.400" />
          <Text fontSize="14px">Перенаправляем ко входу...</Text>
        </Stack>
      </Box>
    );
  }

  return (
    <Box minH="100vh" bg="bg.canvas">
      <Header />
      <Container
        maxW={maxW}
        px={["16px", null, "24px"]}
        py={["24px", null, "40px"]}
        mx={"auto"}
      >
        {children}
      </Container>
    </Box>
  );
}
