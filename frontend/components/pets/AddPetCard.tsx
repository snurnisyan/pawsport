import { Box, Stack, Text } from "@chakra-ui/react";
import { LuPlus } from "react-icons/lu";
import { ChakraLink } from "@/components/ui/NextLink";

export function AddPetCard() {
  return (
    <ChakraLink
      href="/pets/new"
      borderWidth="2px"
      borderStyle="dashed"
      borderColor="border.default"
      rounded="card"
      p={8}
      minH="320px"
      display="flex"
      alignItems="center"
      justifyContent="center"
      cursor="pointer"
      transition="all 0.15s"
      _hover={{ borderColor: "primary.500", color: "primary.400" }}
    >
      <Stack gap={3} align="center" textAlign="center">
        <Box
          w="48px"
          h="48px"
          rounded="full"
          bg="secondary.700"
          display="flex"
          alignItems="center"
          justifyContent="center"
          color="primary.400"
          fontSize="xl"
        >
          <LuPlus />
        </Box>
        <Text fontWeight="semibold">Добавить питомца</Text>
        <Text fontSize="sm" color="fg.muted" maxW="180px">
          Добавьте нового питомца для отслеживания
        </Text>
      </Stack>
    </ChakraLink>
  );
}
