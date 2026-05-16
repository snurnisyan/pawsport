import { Box, Spinner, Stack, Text } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { useAuthSession, useClientReady } from "@/lib/session";

export default function Home() {
  const router = useRouter();
  const session = useAuthSession();
  const clientReady = useClientReady();

  useEffect(() => {
    if (!clientReady) return;

    router.replace(session?.accessToken ? "/pets" : "/auth");
  }, [clientReady, router, session?.accessToken]);

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
        <Text fontSize="14px">Открываем PawsPort...</Text>
      </Stack>
    </Box>
  );
}
