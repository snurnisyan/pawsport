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
import { useState, type ReactNode } from "react";
import {
  LuActivity,
  LuBug,
  LuDownload,
  LuFileText,
  LuMail,
  LuEllipsis,
  LuSyringe,
} from "react-icons/lu";
import { PrimaryButton, SecondaryButton } from "@/components/ui/Buttons";
import { Pressable } from "@/components/ui/Pressable";

const PERIODS = ["Все время", "Год", "Полгода", "3 месяца", "Другой период"];

type TDataType = {
  id: string;
  label: string;
  icon: ReactNode;
  color: string;
};

const DATA_TYPES: TDataType[] = [
  { id: "visits", label: "Визиты и заключения отварачей", icon: <LuFileText />, color: "#93C5FD" },
  { id: "vaccines", label: "Вакцинации", icon: <LuSyringe />, color: "#D8B4FE" },
  { id: "tests", label: "Анализы и обследования (рентген, МРТ, КТ и др.)", icon: <LuActivity />, color: "#FCD34D" },
  { id: "treatments", label: "Обработка от паразитов", icon: <LuBug />, color: "#6EE7B7" },
  { id: "other", label: "Другое", icon: <LuEllipsis />, color: "#94A3B8" },
];

export function ExportTab() {
  const [period, setPeriod] = useState("Полгода");
  const [selected, setSelected] = useState<Record<string, boolean>>({
    visits: true,
    vaccines: true,
  });

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
                onClick={() => setPeriod(p)}
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
        </Stack>

        <Stack gap="12px">
          <Text
            fontSize="12px"
            fontWeight={700}
            letterSpacing="0.12em"
            textTransform="uppercase"
            color="fg.muted"
          >
            Тип данных
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
                    setSelected((s) => ({ ...s, [t.id]: !checked }))
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
        </Stack>

        <SimpleGrid columns={[1, 2]} gap="12px" pt="8px">
          <PrimaryButton>
            <HStack gap="8px">
              <LuDownload />
              <Text>Сохранить PDF</Text>
            </HStack>
          </PrimaryButton>
          <SecondaryButton>
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
