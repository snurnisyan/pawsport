import { Box, HStack } from "@chakra-ui/react";
import { LuSearch } from "react-icons/lu";
import { DateRangeField } from "@/components/ui/DateRangeField";
import { MultiSelectField } from "@/components/ui/MultiSelectField";
import { TextField } from "@/components/ui/TextField";
import { TYPE_OPTIONS, type TEventsFilters } from "./eventsShared";

type TEventsFilterBarProps = {
  value: TEventsFilters;
  onChange: (value: TEventsFilters) => void;
};

export function EventsFilterBar({ value, onChange }: TEventsFilterBarProps) {
  return (
    <HStack gap="12px" flexWrap={["wrap", null, "nowrap"]}>
      <Box flex={1} minW="220px">
        <TextField
          placeholder="Поиск по названию, заметкам..."
          startElement={<LuSearch />}
          uppercase={false}
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
        />
      </Box>
      <Box w={["full", null, "180px"]}>
        <MultiSelectField
          triggerLabel="Тип"
          options={TYPE_OPTIONS}
          selected={value.types}
          onChange={(types) => onChange({ ...value, types })}
        />
      </Box>
      <Box w={["full", null, "220px"]}>
        <DateRangeField
          value={value.dateRange}
          onChange={(dateRange) => onChange({ ...value, dateRange })}
        />
      </Box>
    </HStack>
  );
}
