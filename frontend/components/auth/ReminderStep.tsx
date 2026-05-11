import type { ReactNode } from "react";
import {
  Box,
  HStack,
  Icon,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuBug, LuCalendar, LuPill, LuShieldCheck, LuSyringe, LuWorm } from "react-icons/lu";
import { Card } from "@/components/ui/Card";
import { GhostButton, PrimaryButton } from "@/components/ui/Buttons";
import { StepProgress } from "@/components/ui/StepProgress";
import { TextField } from "@/components/ui/TextField";

type TReminderConfig = {
  id: string;
  label: string;
  icon: ReactNode;
  iconColor: string;
  enabled: boolean;
  lastDate: string;
  frequency: string;
};

const DEFAULT_REMINDERS: TReminderConfig[] = [
  {
    id: "complex",
    label: "Комплексная вакцина",
    icon: <LuSyringe />,
    iconColor: "#A855F7",
    enabled: true,
    lastDate: "12.10.2025",
    frequency: "Ежегодно",
  },
  {
    id: "rabies",
    label: "Вакцина от бешенства",
    icon: <LuShieldCheck />,
    iconColor: "#EF4444",
    enabled: true,
    lastDate: "12.10.2025",
    frequency: "Каждые 3 года",
  },
  {
    id: "external",
    label: "Обработка от внешних паразитов",
    icon: <LuBug />,
    iconColor: "#10B981",
    enabled: true,
    lastDate: "05.04.2026",
    frequency: "Ежемесячно",
  },
  {
    id: "internal",
    label: "Обработка от внутренних паразитов",
    icon: <LuWorm />,
    iconColor: "#14B8A6",
    enabled: true,
    lastDate: "05.04.2026",
    frequency: "Ежемесячно",
  },
];

type TReminderStepProps = {
  onSave: () => void;
  onSkip: () => void;
};

export function ReminderStep({ onSave, onSkip }: TReminderStepProps) {
  return (
    <VStack gap={6} align="stretch" w="full" maxW="640px" mx="auto">
      <VStack gap={2} align="center">
        <StepProgress current={3} total={3} />
        <Text fontSize={{ base: "3xl", md: "4xl" }} fontWeight="bold" mt={6}>
          Первое напоминание
        </Text>
        <Text color="fg.muted" textAlign="center">
          Расскажи о повторяющихся обработках питомца, и мы пришлём напоминание
        </Text>
      </VStack>

      <Stack gap={4}>
        {DEFAULT_REMINDERS.map((r) => (
          <Card key={r.id} p={5}>
            <Stack gap={4}>
              <HStack justify="space-between">
                <HStack gap={3}>
                  <Box
                    w="36px"
                    h="36px"
                    rounded="lg"
                    bg="secondary.700"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    color={r.iconColor}
                  >
                    <Icon boxSize={4}>{r.icon}</Icon>
                  </Box>
                  <Text fontWeight="semibold">{r.label}</Text>
                </HStack>
                <Switch.Root defaultChecked={r.enabled} colorPalette="blue">
                  <Switch.HiddenInput />
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Root>
              </HStack>
              <SimpleGrid columns={2} gap={3}>
                <TextField
                  label="Последняя обработка"
                  placeholder={r.lastDate}
                  startElement={<LuCalendar />}
                />
                <TextField
                  label="Частота"
                  placeholder={r.frequency}
                  endElement={<LuPill />}
                />
              </SimpleGrid>
            </Stack>
          </Card>
        ))}
      </Stack>

      <Stack gap={2}>
        <PrimaryButton onClick={onSave}>Сохранить</PrimaryButton>
        <GhostButton onClick={onSkip}>Пропустить</GhostButton>
      </Stack>
    </VStack>
  );
}