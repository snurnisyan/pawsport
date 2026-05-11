import { AspectRatio, Box, HStack, Image, Stack, Text } from "@chakra-ui/react";
import { LuArrowRight, LuCalendar } from "react-icons/lu";
import { ChakraLink } from "@/components/ui/NextLink";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { TPet } from "@/store/pets";

const SEX_LABEL: Record<TPet["sex"], string> = {
  male: "Мальчик",
  female: "Девочка",
};

type TPetCardProps = {
  pet: TPet;
};

export function PetCard({ pet }: TPetCardProps) {
  return (
    <ChakraLink
      href={`/pets/${pet.id}`}
      display="block"
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.subtle"
      rounded="card"
      shadow="card"
      overflow="hidden"
      cursor="pointer"
      transition="transform 0.2s, box-shadow 0.2s"
      _hover={{ transform: "translateY(-2px)", borderColor: "border.default" }}
    >
      <Box position="relative">
        <AspectRatio ratio={4 / 3}>
          <Image
            src={pet.imageUrl}
            alt={pet.name}
            objectFit="cover"
            w="full"
            h="full"
          />
        </AspectRatio>
        {pet.status && (
          <Box position="absolute" top={3} right={3}>
            <StatusBadge tone={pet.status.tone}>{pet.status.label}</StatusBadge>
          </Box>
        )}
      </Box>

      <Stack gap={3} p={5}>
        <HStack justify="space-between" align="flex-start">
          <Stack gap={1}>
            <Text fontSize="xl" fontWeight="bold">
              {pet.name}
            </Text>
            <Text fontSize="sm" color="fg.muted">
              {pet.ageLabel} · {SEX_LABEL[pet.sex]} · {pet.weightKg} кг
            </Text>
          </Stack>
          <Box color="primary.400" mt={1}>
            <LuArrowRight />
          </Box>
        </HStack>

        {pet.nextEvent && (
          <HStack
            gap={2}
            pt={3}
            borderTopWidth="1px"
            borderColor="border.subtle"
            color={pet.status?.tone === "danger" ? "#FCA5A5" : "fg.muted"}
            fontSize="sm"
          >
            <LuCalendar />
            <Text>{pet.nextEvent}</Text>
          </HStack>
        )}
      </Stack>
    </ChakraLink>
  );
}
