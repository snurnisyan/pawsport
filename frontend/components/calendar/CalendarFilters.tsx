import { Box, Checkbox, HStack, Stack, Text } from "@chakra-ui/react";

type TFilter = {
  id: string;
  label: string;
  color: string;
};

const EVENT_TYPES: TFilter[] = [
  { id: "visit", label: "Визит", color: "#3B82F6" },
  { id: "vaccine", label: "Вакцинация", color: "#A855F7" },
  { id: "treatment", label: "Обработка", color: "#10B981" },
  { id: "operation", label: "Операция", color: "#F59E0B" },
  { id: "tests", label: "Анализы и процедуры", color: "#FCD34D" },
  { id: "other", label: "Другое", color: "#94A3B8" },
];

const PETS: TFilter[] = [
  { id: "kuper", label: "Купер", color: "#3B82F6" },
  { id: "bublik", label: "Бублик", color: "#3B82F6" },
  { id: "musya", label: "Муся", color: "#3B82F6" },
];

type TFilterRowProps = {
  f: TFilter;
  checked: boolean;
};

function FilterRow({ f, checked }: TFilterRowProps) {
  return (
    <Checkbox.Root defaultChecked={checked} colorPalette="blue">
      <Checkbox.HiddenInput />
      <Checkbox.Control />
      <Checkbox.Label>
        <HStack gap={2}>
          <Box w="8px" h="8px" rounded="full" bg={f.color} />
          <Text fontSize="sm">{f.label}</Text>
        </HStack>
      </Checkbox.Label>
    </Checkbox.Root>
  );
}

export function CalendarFilters() {
  return (
    <Stack gap={6}>
      <Stack gap={3}>
        <Text
          fontSize="xs"
          fontWeight="bold"
          letterSpacing="0.12em"
          textTransform="uppercase"
          color="fg.muted"
        >
          Типы событий
        </Text>
        <Stack gap={2}>
          {EVENT_TYPES.map((f) => (
            <FilterRow key={f.id} f={f} checked />
          ))}
        </Stack>
      </Stack>
      <Stack gap={3}>
        <Text
          fontSize="xs"
          fontWeight="bold"
          letterSpacing="0.12em"
          textTransform="uppercase"
          color="fg.muted"
        >
          Питомцы
        </Text>
        <Stack gap={2}>
          {PETS.map((f) => (
            <FilterRow key={f.id} f={f} checked />
          ))}
        </Stack>
      </Stack>
    </Stack>
  );
}
