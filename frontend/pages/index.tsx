import Head from "next/head";
import { Box, Button, Heading, HStack, Text, VStack } from "@chakra-ui/react";
import { useCounterStore } from "@/store/useCounterStore";

export default function Home() {
  const { count, increment, decrement, reset } = useCounterStore();

  return (
    <>
      <Head>
        <title>Pawsport</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Box minH="100vh" display="flex" alignItems="center" justifyContent="center">
        <VStack gap={6}>
          <Heading size="2xl">Pawsport</Heading>
          <Text color="fg.muted">Next.js 16 · Chakra UI · Zustand</Text>
          <Text fontSize="4xl" fontWeight="bold">
            {count}
          </Text>
          <HStack>
            <Button onClick={decrement} variant="outline">
              -
            </Button>
            <Button onClick={reset} variant="subtle">
              Reset
            </Button>
            <Button onClick={increment} colorPalette="teal">
              +
            </Button>
          </HStack>
        </VStack>
      </Box>
    </>
  );
}
