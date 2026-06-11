import { useState, type ReactNode } from "react";
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
  LuShieldCheck,
  LuSyringe,
  LuWorm
} from "react-icons/lu";
import { Card } from "@/components/ui/Card";
import { GhostButton, PrimaryButton } from "@/components/ui/Buttons";
import { StepProgress } from "@/components/ui/StepProgress";
import { DateInput } from "@/components/ui/DateInput";
import { subtractDays, subtractMonths, toDateOnly } from "@/utils/dates";

type TReminderKind = "vaccine" | "treatment";

type TReminderSubtype = "complex" | "rabies" | "internal" | "external";

export type TReminderDraft = {
  type: TReminderKind;
  subtype: TReminderSubtype;
  title: string;
  lastDate: string;
  nextDate: string;
};

type TReminderConfig = {
  id: TReminderSubtype;
  label: string;
  icon: ReactNode;
  iconColor: string;
  enabled: boolean;
  kind: TReminderKind;
};

const DEFAULT_REMINDERS: TReminderConfig[] = [
  {
    id: "complex",
    label: "Комплексная вакцина",
    icon: <LuSyringe />,
    iconColor: "#A855F7",
    enabled: true,
    kind: "vaccine",
  },
  {
    id: "rabies",
    label: "Вакцина от бешенства",
    icon: <LuShieldCheck />,
    iconColor: "#A855F7",
    enabled: true,
    kind: "vaccine",
  },
  {
    id: "external",
    label: "Обработка от внешних паразитов",
    icon: <LuBug />,
    iconColor: "#10B981",
    enabled: true,
    kind: "treatment",
  },
  {
    id: "internal",
    label: "Обработка от внутренних паразитов",
    icon: <LuWorm />,
    iconColor: "#10B981",
    enabled: true,
    kind: "treatment",
  },
];

const defaultLastDate = (kind: TReminderKind): string =>
  kind === "vaccine"
    ? toDateOnly(subtractMonths(new Date(), 2))
    : toDateOnly(subtractDays(new Date(), 14));

function computeNextDate(lastDate: string, kind: TReminderKind): string {
  if (!lastDate) return "";
  const [year, month, day] = lastDate.split("-").map(Number);
  const next = new Date(year, month - 1, day);
  if (kind === "vaccine") {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  const yyyy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, "0");
  const dd = String(next.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

type TReminderState = {
  enabled: boolean;
  lastDate: string;
  nextDate: string;
};

type TReminderStepProps = {
  onSave: (reminders: TReminderDraft[]) => void;
  onSkip: () => void;
  isSubmitting?: boolean;
  errorText?: string;
};

export function ReminderStep({
  onSave,
  onSkip,
  isSubmitting = false,
  errorText,
}: TReminderStepProps) {
  const [state, setState] = useState<Record<string, TReminderState>>(() =>
    Object.fromEntries(
      DEFAULT_REMINDERS.map((r) => {
        const lastDate = defaultLastDate(r.kind);
        return [
          r.id,
          {
            enabled: r.enabled,
            lastDate,
            nextDate: computeNextDate(lastDate, r.kind),
          },
        ];
      }),
    ),
  );

  const updateLastDate = (r: TReminderConfig, value: string) => {
    setState((prev) => ({
      ...prev,
      [r.id]: {
        ...prev[r.id],
        lastDate: value,
        nextDate: computeNextDate(value, r.kind),
      },
    }));
  };

  const updateNextDate = (id: string, value: string) => {
    setState((prev) => ({
      ...prev,
      [id]: { ...prev[id], nextDate: value },
    }));
  };

  const toggleEnabled = (id: string, value: boolean) => {
    setState((prev) => ({
      ...prev,
      [id]: { ...prev[id], enabled: value },
    }));
  };

  const handleSave = () => {
    onSave(
      DEFAULT_REMINDERS.filter(
        (r) => state[r.id].enabled && state[r.id].lastDate,
      ).map((r) => ({
        type: r.kind,
        subtype: r.id,
        title: r.label,
        lastDate: state[r.id].lastDate,
        nextDate: state[r.id].nextDate,
      })),
    );
  };

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
        {DEFAULT_REMINDERS.map((r) => {
          const s = state[r.id];
          return (
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
                  <Switch.Root
                    checked={s.enabled}
                    onCheckedChange={(e) => toggleEnabled(r.id, e.checked)}
                    colorPalette="blue"
                  >
                    <Switch.HiddenInput />
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Root>
                </Flex>
                <Flex flexDir={["column", "column", "row"]} gap="12px">
                  <DateInput
                    label="Последняя обработка"
                    value={s.lastDate}
                    onChange={(iso) => updateLastDate(r, iso)}
                  />
                  <DateInput
                    label="Следующая обработка"
                    value={s.nextDate}
                    onChange={(iso) => updateNextDate(r.id, iso)}
                  />
                </Flex>
              </Stack>
            </Card>
          );
        })}
      </Stack>

      <Stack gap="8px">
        {errorText && (
          <Text color="red.400" fontSize="sm" textAlign="center">
            {errorText}
          </Text>
        )}
        <PrimaryButton onClick={handleSave} loading={isSubmitting}>
          Сохранить
        </PrimaryButton>
        <GhostButton onClick={onSkip} disabled={isSubmitting}>
          Пропустить
        </GhostButton>
      </Stack>
    </VStack>
  );
}
