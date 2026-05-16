import type { ReactNode } from "react";
import {
  Box, Flex,
  Icon,
  Stack,
  Switch,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  LuBug,
  LuCalendar, LuChevronDown,
  LuShieldCheck,
  LuSyringe,
  LuWorm
} from "react-icons/lu";
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
    iconColor: "#A855F7",
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
    iconColor: "#10B981",
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
    <VStack gap="24px" align="stretch" w="full" maxW="640px" mx="auto">
      <VStack gap="8px" align="center">
        <StepProgress current={3} total={3} />
        <Text fontSize={["30px", null, "36px"]} fontWeight={700} mt="24px">
          Первое напоминание
        </Text>
        <Text color="fg.muted" textAlign="center">
          Расскажи о повторяющихся обработках питомца, и мы пришлём напоминание
        </Text>
      </VStack>

      <Stack gap="16px">
        {DEFAULT_REMINDERS.map((r) => (
          <Card key={r.id} p="20px">
            <Stack gap="16px">
              <Flex justifyContent="space-between">
                <Flex gap="12px" alignItems="center">
                  <Box
                    w={["28px", "28px", "36px"]}
                    h={["28px", "28px", "36px"]}
                    rounded="full"
                    bg="secondary.700"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    color={r.iconColor}
                    flexShrink={0}
                  >
                    <Icon boxSize="16px">{r.icon}</Icon>
                  </Box>
                  <Text fontWeight={600}>{r.label}</Text>
                </Flex>
                <Switch.Root defaultChecked={r.enabled} colorPalette="blue">
                  <Switch.HiddenInput />
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Root>
              </Flex>
              <Flex flexDir={["column", "column", "row"]} gap="12px">
                <TextField
                  label="Последняя обработка"
                  placeholder={r.lastDate}
                  endElement={<LuCalendar />}
                />
                <TextField
                  label="Частота"
                  placeholder={r.frequency}
                  endElement={<LuChevronDown />}
                />
              </Flex>
            </Stack>
          </Card>
        ))}
      </Stack>

      <Stack gap="8px">
        <PrimaryButton onClick={onSave}>Сохранить</PrimaryButton>
        <GhostButton onClick={onSkip}>Пропустить</GhostButton>
      </Stack>
    </VStack>
  );
}
