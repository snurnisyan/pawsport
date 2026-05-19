import type { ReactNode } from "react";
import {
  Box,
  Checkbox,
  HStack,
  Heading,
  Icon,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { LuDownload, LuMail } from "react-icons/lu";
import { DateRangeField, type TDateRange } from "@/components/ui/DateRangeField";
import { PrimaryButton, SecondaryButton } from "@/components/ui/Buttons";
import { Pressable } from "@/components/ui/Pressable";
import { EVENT_TYPE_META, EVENT_TYPE_OPTIONS } from "@/lib/eventTypes";
import { PERIODS, type TExportEventType, type TExportMode, type TPeriod } from "./types";

type TDataTypeRow = {
  id: TExportEventType;
  label: string;
  icon: ReactNode;
  color: string;
};

const DATA_TYPES: TDataTypeRow[] = EVENT_TYPE_OPTIONS.map((option) => {
  const meta = EVENT_TYPE_META[option.value];
  const EventIcon = meta.Icon;
  return {
    id: option.value,
    label: option.label,
    icon: <EventIcon />,
    color: meta.color,
  };
});

type TExportSettingsProps = {
  period: TPeriod;
  customPeriod: TDateRange;
  selected: Record<TExportEventType, boolean>;
  hasSelectedDataType: boolean;
  canSubmit: boolean;
  isBusy: boolean;
  onPeriodChange: (period: TPeriod) => void;
  onCustomPeriodChange: (period: TDateRange) => void;
  onSelectedChange: (
    update: (
      prev: Record<TExportEventType, boolean>
    ) => Record<TExportEventType, boolean>
  ) => void;
  onStart: (mode: TExportMode) => void;
};

export function ExportSettings({
  period,
  customPeriod,
  selected,
  hasSelectedDataType,
  canSubmit,
  isBusy,
  onPeriodChange,
  onCustomPeriodChange,
  onSelectedChange,
  onStart,
}: TExportSettingsProps) {
  return (
    <Box
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.subtle"
      rounded="card"
      p={["20px", null, "28px"]}
    >
      <Stack gap="24px">
        <Stack gap="4px">
          <Heading size="lg">Экспорт данных о питомце</Heading>
          <Text color="fg.muted" fontSize="14px">
            Выберите период и тип данных для выгрузки
          </Text>
        </Stack>

        <Stack gap="12px">
          <Text
            fontSize="12px"
            fontWeight={700}
            letterSpacing="0.12em"
            textTransform="uppercase"
            color="fg.muted"
          >
            Период
          </Text>
          <HStack gap="8px" flexWrap="wrap">
            {PERIODS.map((p) => (
              <Pressable
                key={p}
                type="button"
                onClick={() => onPeriodChange(p)}
                px="16px"
                py="8px"
                rounded="full"
                fontSize="14px"
                fontWeight={500}
                borderWidth="1px"
                cursor="pointer"
                transition="all 0.15s"
                bg={period === p ? "secondary.500" : "transparent"}
                borderColor={period === p ? "border.default" : "border.subtle"}
                color={period === p ? "fg.default" : "fg.muted"}
                _hover={{ borderColor: "border.default" }}
              >
                {p}
              </Pressable>
            ))}
          </HStack>
          {period === "Другой период" && (
            <Box maxW="360px">
              <DateRangeField
                triggerLabel="Выберите даты"
                value={customPeriod}
                onChange={onCustomPeriodChange}
              />
            </Box>
          )}
        </Stack>

        <Stack gap="12px">
          <Text
            fontSize="12px"
            fontWeight={700}
            letterSpacing="0.12em"
            textTransform="uppercase"
            color="fg.muted"
          >
            Типы событий
          </Text>
          <Stack gap="8px">
            {DATA_TYPES.map((t) => {
              const checked = Boolean(selected[t.id]);
              return (
                <HStack
                  key={t.id}
                  bg="secondary.700"
                  borderWidth="1px"
                  borderColor="border.subtle"
                  rounded="card"
                  px="16px"
                  py="12px"
                  justify="space-between"
                  cursor="pointer"
                  onClick={() =>
                    onSelectedChange((s) => ({ ...s, [t.id]: !checked }))
                  }
                >
                  <HStack gap="12px">
                    <Box color={t.color}>
                      <Icon boxSize="16px">{t.icon}</Icon>
                    </Box>
                    <Text fontSize="14px" fontWeight={500}>
                      {t.label}
                    </Text>
                  </HStack>
                  <Checkbox.Root
                    checked={checked}
                    colorPalette="blue"
                    pointerEvents="none"
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                  </Checkbox.Root>
                </HStack>
              );
            })}
          </Stack>
          {!hasSelectedDataType && (
            <Text color="red.200" fontSize="13px">
              Выберите хотя бы один тип событий
            </Text>
          )}
        </Stack>

        <SimpleGrid columns={[1, 2]} gap="12px" pt="8px">
          <PrimaryButton
            disabled={!canSubmit || isBusy}
            onClick={() => onStart("download")}
          >
            <HStack gap="8px">
              <LuDownload />
              <Text>Сохранить PDF</Text>
            </HStack>
          </PrimaryButton>
          <SecondaryButton
            disabled={!canSubmit || isBusy}
            onClick={() => onStart("email")}
          >
            <HStack gap="8px">
              <LuMail />
              <Text>Отправить по почте</Text>
            </HStack>
          </SecondaryButton>
        </SimpleGrid>
      </Stack>
    </Box>
  );
}
