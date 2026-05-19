import { useState, type MouseEvent } from "react";
import { AspectRatio, Box, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { LuCalendar, LuCalendarPlus } from "react-icons/lu";
import { ChakraLink } from "@/components/ui/NextLink";
import { GhostButton } from "@/components/ui/Buttons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PetImage } from "@/components/pets/PetImage";
import { EventDialog } from "@/components/pets/events/EventDialog";
import type { TPet, TPetExpiredEvent } from "@/store/pets";
import DogIcon from "@/icons/dog-icon.svg";
import CatIcon from "@/icons/cat.svg";

const SEX_LABEL: Record<TPet["sex"], string> = {
  male: "Мальчик",
  female: "Девочка",
  unknown: "Пол не указан",
};

const EXPIRED_LABEL: Record<TPetExpiredEvent["type"], string> = {
  vaccine: "Просрочена вакцинация",
  treatment: "Просрочена обработка",
};

const formatShortDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  }).format(date);
};

const toIsoDate = (value: string): string => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

type TPetCardProps = {
  pet: TPet;
};

export function PetCard({ pet }: TPetCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const expiredEvent = pet.expiredEvents?.[0];

  const handleUpdateClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDialogOpen(true);
  };

  const expiredLabel = expiredEvent ? EXPIRED_LABEL[expiredEvent.type] : null;
  const expiredDateLabel = expiredEvent ? formatShortDate(expiredEvent.nextDate) : "";
  const nextEventText = expiredLabel
    ? expiredDateLabel
      ? `${expiredLabel}: ${expiredDateLabel}`
      : expiredLabel
    : null;

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
          {expiredLabel && (
            <Box position="absolute" top="12px" right="12px" zIndex={2}>
              <StatusBadge styleColors={{ bg: "#EF4444", color: "white" }}>
                {expiredLabel}
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

          {nextEventText && expiredEvent && (
            <HStack
              gap="8px"
              pt="12px"
              borderTopWidth="1px"
              borderColor="border.subtle"
              justify="space-between"
              align="center"
            >
              <HStack gap="8px" color="#FCA5A5" fontSize="14px" minW={0}>
                <LuCalendar />
                <Text truncate>{nextEventText}</Text>
              </HStack>
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
            </HStack>
          )}
        </Stack>
      </Box>

      {expiredEvent && (
        <EventDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          petId={pet.id}
          initialData={{
            petId: pet.id,
            type: expiredEvent.type,
            subtype: expiredEvent.subtype,
            date: toIsoDate(expiredEvent.nextDate),
            title: expiredEvent.title,
          }}
        />
      )}
    </>
  );
}
