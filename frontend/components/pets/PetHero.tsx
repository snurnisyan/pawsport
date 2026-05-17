import { useState } from "react";
import {
  AspectRatio,
  Box,
  HStack,
  Icon,
  IconButton,
  Stack,
  Text,
} from "@chakra-ui/react";
import { LuCake, LuCircleHelp, LuPenLine } from "react-icons/lu";
import { FaMars, FaVenus } from "react-icons/fa6";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PetImage } from "@/components/pets/PetImage";
import { PhotoUploadDialog } from "@/components/pets/PhotoUploadDialog";
import type { TPet } from "@/store/pets";

type TPetHeroProps = {
  pet: TPet;
};

export function PetHero({ pet }: TPetHeroProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [photoOverrides, setPhotoOverrides] = useState<Record<string, string>>({});
  const photoUrl = photoOverrides[pet.id] ?? pet.imageUrl;
  const sexMeta =
    pet.sex === "male"
      ? { icon: <FaMars />, label: "Мальчик" }
      : pet.sex === "female"
        ? { icon: <FaVenus />, label: "Девочка" }
        : { icon: <LuCircleHelp />, label: "Пол не указан" };

  return (
    <>
      <Box
        position="relative"
        rounded="card"
        overflow="hidden"
        borderWidth="1px"
        borderColor="border.subtle"
      >
        <AspectRatio ratio={[16 / 10, null, 21 / 9]}>
          <PetImage src={photoUrl} alt={pet.name} />
        </AspectRatio>
        <Box
          position="absolute"
          inset={0}
          pointerEvents="none"
          bgGradient="to-t"
          gradientFrom="rgba(5,8,16,0.98)"
          gradientVia="rgba(5,8,16,0.65) 35%"
          gradientTo="rgba(5,8,16,0)"
        />
        <IconButton
          aria-label="Редактировать фото"
          position="absolute"
          top="16px"
          right="16px"
          size="md"
          rounded="full"
          bg="bg.canvas/85"
          color="primary.300"
          borderWidth="1px"
          borderColor="border.default"
          backdropFilter="blur(10px)"
          shadow="card"
          onClick={() => setDialogOpen(true)}
          _hover={{
            bg: "bg.canvas",
            borderColor: "border.accent",
            color: "primary.200",
          }}
        >
          <LuPenLine />
        </IconButton>
        <Stack
          position="absolute"
          bottom={["16px", null, "24px"]}
          left={["16px", null, "24px"]}
          right={["16px", null, "24px"]}
          gap="8px"
        >
          <HStack gap="12px" flexWrap="wrap">
            <Text
              fontSize={["30px", null, "48px"]}
              fontWeight={700}
              lineHeight={1}
              color="white"
              textShadow="0 2px 12px rgba(0,0,0,0.5)"
            >
              {pet.name}
            </Text>
            <StatusBadge tone="info">{pet.breed}</StatusBadge>
          </HStack>
          <HStack gap="16px" color="fg.subtle" fontSize="14px">
            <HStack gap="4px">
              <Icon>
                <LuCake />
              </Icon>
              <Text>{pet.ageLabel}</Text>
            </HStack>
            <HStack gap="4px">
              <Icon>{sexMeta.icon}</Icon>
              <Text>{sexMeta.label}</Text>
            </HStack>
          </HStack>
        </Stack>
      </Box>

      <PhotoUploadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        petName={pet.name}
        onSave={(file) =>
          setPhotoOverrides((current) => ({
            ...current,
            [pet.id]: URL.createObjectURL(file),
          }))
        }
      />
    </>
  );
}
