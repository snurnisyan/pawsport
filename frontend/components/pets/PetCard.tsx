import { AspectRatio, Box, HStack, Stack, Text } from "@chakra-ui/react";
import { LuArrowRight, LuCalendar } from "react-icons/lu";
import { ChakraLink } from "@/components/ui/NextLink";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PetImage } from "@/components/pets/PetImage";
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
          <PetImage src={pet.imageUrl} alt={pet.name} />
        </AspectRatio>
        {pet.status && (
          <Box position="absolute" top="12px" right="12px">
            <StatusBadge tone={pet.status.tone} variant={"bright"}>
              {pet.status.label}
            </StatusBadge>
          </Box>
        )}
      </Box>

      <Stack gap="12px" p="20px">
        <HStack justify="space-between" align="flex-start">
          <Stack gap="4px">
            <Text fontSize="20px" fontWeight={700}>
              {pet.name}
            </Text>
            <Text fontSize="14px" color="fg.muted">
              {pet.ageLabel} · {SEX_LABEL[pet.sex]} · {pet.weightKg} кг
            </Text>
          </Stack>
          <Box color="fg.accent" mt="4px">
            <LuArrowRight />
          </Box>
        </HStack>

        {pet.nextEvent && (
          <HStack
            gap="8px"
            pt="12px"
            borderTopWidth="1px"
            borderColor="border.subtle"
            color={pet.status?.tone === "danger" ? "#FCA5A5" : "fg.muted"}
            fontSize="14px"
          >
            <LuCalendar />
            <Text>{pet.nextEvent}</Text>
          </HStack>
        )}
      </Stack>
    </ChakraLink>
  );
}
