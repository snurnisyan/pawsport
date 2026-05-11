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
      p={{ base: 5, md: 7 }}
    >
      <Stack gap={6}>
        <Stack gap={1}>
          <Heading size="lg">Экспорт данных о питомце</Heading>
          <Text color="fg.muted" fontSize="sm">
            Выберите период и тип данных для выгрузки
          </Text>
        </Stack>

        <Stack gap={3}>
          <Text
            fontSize="xs"
            fontWeight="bold"
            letterSpacing="0.12em"
            textTransform="uppercase"
            color="fg.muted"
          >
            Период
          </Text>
          <HStack gap={2} flexWrap="wrap">
            {PERIODS.map((p) => (
              <Pressable
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                px={4}
                py={2}
                rounded="full"
                fontSize="sm"
                fontWeight="medium"
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

        <Stack gap={3}>
          <Text
            fontSize="xs"
            fontWeight="bold"
            letterSpacing="0.12em"
            textTransform="uppercase"
            color="fg.muted"
          >
            Тип данных
          </Text>
          <Stack gap={2}>
            {DATA_TYPES.map((t) => {
              const checked = Boolean(selected[t.id]);
              return (
                <HStack
                  key={t.id}
                  bg="secondary.700"
                  borderWidth="1px"
                  borderColor="border.subtle"
                  rounded="card"
                  px={4}
                  py={3}
                  justify="space-between"
                  cursor="pointer"
                  onClick={() =>
                    setSelected((s) => ({ ...s, [t.id]: !checked }))
                  }
                >
                  <HStack gap={3}>
                    <Box color={t.color}>
                      <Icon boxSize={4}>{t.icon}</Icon>
                    </Box>
                    <Text fontSize="sm" fontWeight="medium">
                      {t.label}
                    </Text>
                  </HStack>
                  <Checkbox.Root
                    checked={checked}
                    onCheckedChange={(d) =>
                      setSelected((s) => ({ ...s, [t.id]: Boolean(d.checked) }))
                    }
                    colorPalette="blue"
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                  </Checkbox.Root>
                </HStack>
              );
            })}
          </Stack>
        </Stack>

        <SimpleGrid columns={{ base: 1, sm: 2 }} gap={3} pt={2}>
          <PrimaryButton>
            <HStack gap={2}>
              <LuDownload />
              <Text>Сохранить PDF</Text>
            </HStack>
          </PrimaryButton>
          <SecondaryButton>
            <HStack gap={2}>
              <LuMail />
              <Text>Отправить по почте</Text>
            </HStack>
          </SecondaryButton>
        </SimpleGrid>
      </Stack>
    </Box>
  );
}
