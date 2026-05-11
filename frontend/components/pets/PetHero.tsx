import {
  AspectRatio,
  Box,
  HStack,
  Icon,
  IconButton,
  Image,
  Stack,
  Text,
} from "@chakra-ui/react";
import { LuCake, LuPenLine } from "react-icons/lu";
import { FaMars, FaVenus } from "react-icons/fa6";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { TPet } from "@/store/pets";

type TPetHeroProps = {
  pet: TPet;
};

export function PetHero({ pet }: TPetHeroProps) {
  return (
    <Box
      position="relative"
      rounded="card"
      overflow="hidden"
      borderWidth="1px"
      borderColor="border.subtle"
    >
      <AspectRatio ratio={{ base: 16 / 10, md: 21 / 9 }}>
        <Image
          src={pet.imageUrl}
          alt={pet.name}
          objectFit="cover"
          w="full"
          h="full"
        />
      </AspectRatio>
      <Box
        position="absolute"
        inset={0}
        bgGradient="linear(to-t, rgba(5,8,16,0.95) 0%, rgba(5,8,16,0.4) 50%, rgba(5,8,16,0) 100%)"
      />
      <IconButton
        aria-label="Редактировать"
        position="absolute"
        top={4}
        right={4}
        size="sm"
        rounded="full"
        bg="bg.canvas/80"
        color="primary.400"
        backdropFilter="blur(8px)"
        _hover={{ bg: "bg.canvas" }}
      >
        <LuPenLine />
      </IconButton>
      <Stack
        position="absolute"
        bottom={{ base: 4, md: 6 }}
        left={{ base: 4, md: 6 }}
        gap={2}
      >
        <HStack gap={3} flexWrap="wrap">
          <Text
            fontSize={{ base: "3xl", md: "5xl" }}
            fontWeight="bold"
            lineHeight={1}
          >
            {pet.name}
          </Text>
          <StatusBadge tone="info">{pet.breed}</StatusBadge>
        </HStack>
        <HStack gap={4} color="fg.subtle" fontSize="sm">
          <HStack gap={1}>
            <Icon>
              <LuCake />
            </Icon>
            <Text>{pet.ageLabel}</Text>
          </HStack>
          <HStack gap={1}>
            <Icon>{pet.sex === "male" ? <FaMars /> : <FaVenus />}</Icon>
            <Text>{pet.sex === "male" ? "Мальчик" : "Девочка"}</Text>
          </HStack>
        </HStack>
      </Stack>
    </Box>
  );
}
