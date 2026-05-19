import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { toaster } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api";
import {
  petQueryKey,
  petsQueryKey,
  uploadPetPhoto,
  type TPetListResponse,
  type TPetResponse,
} from "@/lib/petsApi";
import { useAuthSession } from "@/lib/session";
import type { TPet } from "@/store/pets";
import { EVENT_TYPE_META } from "@/lib/eventTypes";

type TPetHeroProps = {
  pet: TPet;
};

const apiErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) return error.message;
  return "Не удалось загрузить фото. Проверьте формат и попробуйте еще раз.";
};

export function PetHero({ pet }: TPetHeroProps) {
  const session = useAuthSession();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [localPhotoUrl, setLocalPhotoUrl] = useState<string | null>(null);
  const photoUrl = localPhotoUrl ?? pet.imageUrl;
  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadPetPhoto(pet.id, file),
    onSuccess: async (response) => {
      queryClient.setQueryData<TPetResponse>(petQueryKey(response.pet.id), {
        pet: response.pet,
      });
      queryClient.setQueryData<TPetListResponse>(petsQueryKey, (previous) =>
        previous
          ? {
              ...previous,
              items: previous.items.map((item) =>
                item.id === response.pet.id ? response.pet : item
              ),
            }
          : previous
      );
      setLocalPhotoUrl(null);
      await queryClient.invalidateQueries({ queryKey: petsQueryKey });
      toaster.success({ title: "Фото обновлено" });
    },
    onError: (error) => {
      toaster.error({
        title: "Не удалось загрузить фото",
        description: apiErrorMessage(error),
      });
    },
  });

  useEffect(() => {
    if (!localPhotoUrl) return;
    return () => URL.revokeObjectURL(localPhotoUrl);
  }, [localPhotoUrl]);

  const handlePhotoSave = async (file: File) => {
    if (!session) {
      setLocalPhotoUrl(URL.createObjectURL(file));
      return;
    }
    await uploadMutation.mutateAsync(file);
  };

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
              fontSize={["30px", null, "44px"]}
              fontWeight={700}
              lineHeight={1}
              color="white"
              textShadow="0 2px 12px rgba(0,0,0,0.5)"
              mb={["4px", "4px", "12px"]}
            >
              {pet.name}
            </Text>
            {pet.breed && <StatusBadge styleColors={EVENT_TYPE_META["visit"]}>{pet.breed}</StatusBadge>}
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
        onSave={handlePhotoSave}
        isPending={uploadMutation.isPending}
      />
    </>
  );
}
