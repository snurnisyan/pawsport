import { useState, type MouseEvent } from "react";
import { AspectRatio, Box, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { LuCalendar, LuCalendarPlus } from "react-icons/lu";
import { ChakraLink } from "@/components/ui/NextLink";
import { GhostButton } from "@/components/ui/Buttons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PetImage } from "@/components/pets/PetImage";
import { EventDialog } from "@/components/pets/events/EventDialog";
import type { TPet } from "@/store/pets";
import DogIcon from "@/icons/dog-icon.svg";
import CatIcon from "@/icons/cat.svg";
import {TYPE_BG, TYPE_BG_BRIGHT, TYPE_COLOR} from "@/components/pets/events/eventsShared";

const SEX_LABEL: Record<TPet["sex"], string> = {
  male: "Мальчик",
  female: "Девочка",
  unknown: "Пол не указан",
};

const RECURRING_LABEL: Record<"vaccine" | "treatment", string> = {
  vaccine: "Вакцинация",
  treatment: "Обработка",
};

const detectRecurringType = (pet: TPet): "vaccine" | "treatment" | null => {
  const haystack = `${pet.status?.label ?? ""} ${pet.nextEvent ?? ""}`.toLowerCase();
  if (haystack.includes("вакцин")) return "vaccine";
  if (haystack.includes("обработ")) return "treatment";
  return null;
};

type TPetCardProps = {
  pet: TPet;
};

export function PetCard({ pet }: TPetCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const recurringType = detectRecurringType(pet);
  const showUpdateButton = Boolean(pet.status) && recurringType !== null;

  const handleUpdateClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDialogOpen(true);
  };

  return (
    <>
      <Box
        position="relative"
        bg="bg.surface"
        borderWidth="1px"
        borderColor="border.subtle"
        rounded="card"
        shadow="card"
        overflow="hidden"
        transition="transform 0.2s, box-shadow 0.2s, border-color 0.2s"
        _hover={{ transform: "translateY(-2px)", borderColor: "border.default" }}
      >
        <ChakraLink
          href={`/pets/${pet.id}`}
          position="absolute"
          inset={0}
          zIndex={1}
          aria-label={`Открыть карточку ${pet.name}`}
        />

        <Box position="relative">
          <AspectRatio ratio={4 / 3}>
            <PetImage src={pet.imageUrl} alt={pet.name} />
          </AspectRatio>
          {pet.status && (
            <Box position="absolute" top="12px" right="12px" zIndex={2}>
              <StatusBadge styleColors={{ bg: TYPE_BG_BRIGHT[pet.status], color: "white" }}>
                {pet.status.label}
              </StatusBadge>
            </Box>
          )}
        </Box>

        <Stack gap="12px" p="20px" position="relative">
          <Stack gap="4px">
            <HStack justify="space-between" align="center">
              <Text fontSize="20px" fontWeight={700}>
                {pet.name}
              </Text>
              {pet.species === "dog" && (
                <Icon color="fg.accent" flexShrink={0}>
                  <DogIcon />
                </Icon>
              )}
              {pet.species === "cat" && (
                <Icon color="fg.accent" flexShrink={0}>
                  <CatIcon />
                </Icon>
              )}
            </HStack>
            <HStack justify="space-between" align="center">
              <Text fontSize="14px" color="fg.muted">
                {pet.ageLabel} · {SEX_LABEL[pet.sex]}
                {pet.weightKg > 0 ? ` · ${pet.weightKg} кг` : ""}
              </Text>
            </HStack>
          </Stack>

          {pet.nextEvent && (
            <HStack
              gap="8px"
              pt="12px"
              borderTopWidth="1px"
              borderColor="border.subtle"
              justify="space-between"
              align="center"
            >
              <HStack
                gap="8px"
                color={pet.status?.tone === "danger" ? "#FCA5A5" : "fg.muted"}
                fontSize="14px"
                minW={0}
              >
                <LuCalendar />
                <Text truncate>{pet.nextEvent}</Text>
              </HStack>
              {showUpdateButton && (
                <Box position="relative" zIndex={2} flexShrink={0}>
                  <GhostButton
                    h="32px"
                    px="10px"
                    fontSize="13px"
                    onClick={handleUpdateClick}
                  >
                    <HStack gap="6px">
                      <LuCalendarPlus />
                      <Text>Добавить</Text>
                    </HStack>
                  </GhostButton>
                </Box>
              )}
            </HStack>
          )}
        </Stack>
      </Box>

      {showUpdateButton && recurringType && (
        <EventDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          initialData={{
            petId: pet.id,
            type: recurringType,
            title: RECURRING_LABEL[recurringType],
          }}
        />
      )}
    </>
  );
}
