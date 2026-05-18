import { Box, Checkbox, HStack, Stack, Text } from "@chakra-ui/react";
import { EVENT_TYPE_FILTER_OPTIONS } from "@/lib/eventTypes";
import type { TPetEventType } from "@/store/pets";

type TFilter = {
  id: string;
  label: string;
  color?: string;
};

export type TCalendarPetFilterOption = {
  value: string;
  label: string;
};

type TFilterRowProps = {
  f: TFilter;
  checked: boolean;
  showCircle?: boolean;
  onCheckedChange: (checked: boolean) => void;
};

function FilterRow({ f, checked, showCircle, onCheckedChange }: TFilterRowProps) {
  return (
    <Checkbox.Root
      checked={checked}
      onCheckedChange={(d) => onCheckedChange(Boolean(d.checked))}
      colorPalette="blue"
      size="sm"
    >
      <Checkbox.HiddenInput />
      <Checkbox.Control />
      <Checkbox.Label>
        <HStack gap="8px">
          {showCircle && <Box w="8px" h="8px" rounded="full" bg={f.color} />}
          <Text fontSize="14px">{f.label}</Text>
        </HStack>
      </Checkbox.Label>
    </Checkbox.Root>
  );
}

type TCalendarFiltersProps = {
  selectedEventTypes: TPetEventType[];
  selectedPetIds: string[];
  pets: TCalendarPetFilterOption[];
  petsLoading?: boolean;
  petsError?: string;
  onEventTypesChange: (types: TPetEventType[]) => void;
  onPetIdsChange: (petIds: string[]) => void;
};

const EVENT_TYPE_FILTERS: TFilter[] = EVENT_TYPE_FILTER_OPTIONS.map(
  ({ value, label, color }) => ({
    id: value,
    label,
    color,
  })
);

const toggleValue = <T extends string>(
  current: T[],
  value: T,
  checked: boolean
): T[] =>
  checked ? Array.from(new Set([...current, value])) : current.filter((v) => v !== value);

export function CalendarFilters({
  selectedEventTypes,
  selectedPetIds,
  pets,
  petsLoading = false,
  petsError,
  onEventTypesChange,
  onPetIdsChange,
}: TCalendarFiltersProps) {
  return (
    <Stack gap="24px">
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
          {EVENT_TYPE_FILTERS.map((f) => (
            <FilterRow
              key={f.id}
              f={f}
              checked={selectedEventTypes.includes(f.id as TPetEventType)}
              showCircle
              onCheckedChange={(checked) =>
                onEventTypesChange(
                  toggleValue(selectedEventTypes, f.id as TPetEventType, checked)
                )
              }
            />
          ))}
        </Stack>
      </Stack>
      <Stack gap="12px">
        <Text
          fontSize="12px"
          fontWeight={700}
          letterSpacing="0.12em"
          textTransform="uppercase"
          color="fg.muted"
        >
          Питомцы
        </Text>
        <Stack gap="8px">
          {petsLoading ? (
            <Text fontSize="14px" color="fg.muted">
              Загружаем питомцев...
            </Text>
          ) : petsError ? (
            <Text fontSize="14px" color="red.200">
              {petsError}
            </Text>
          ) : pets.length === 0 ? (
            <Text fontSize="14px" color="fg.muted">
              Питомцев пока нет
            </Text>
          ) : (
            pets.map((pet) => (
              <FilterRow
                key={pet.value}
                f={{ id: pet.value, label: pet.label }}
                checked={selectedPetIds.includes(pet.value)}
                onCheckedChange={(checked) =>
                  onPetIdsChange(toggleValue(selectedPetIds, pet.value, checked))
                }
              />
            ))
          )}
        </Stack>
      </Stack>
    </Stack>
  );
}
