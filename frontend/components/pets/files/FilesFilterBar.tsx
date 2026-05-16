import { Box, HStack } from "@chakra-ui/react";
import { LuSearch } from "react-icons/lu";
import { DateRangeField, type TDateRange } from "@/components/ui/DateRangeField";
import { TextField } from "@/components/ui/TextField";

export type TFilesFilters = {
  search: string;
  dateRange: TDateRange;
};

export const INITIAL_FILES_FILTERS: TFilesFilters = {
  search: "",
  dateRange: { from: "", to: "" },
};

type TFilesFilterBarProps = {
  value: TFilesFilters;
  onChange: (value: TFilesFilters) => void;
};

export function FilesFilterBar({ value, onChange }: TFilesFilterBarProps) {
  return (
    <HStack gap="12px" flexWrap={["wrap", null, "nowrap"]}>
      <Box flex={1} minW="220px">
        <TextField
          placeholder="Поиск по названию..."
          startElement={<LuSearch />}
          uppercase={false}
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
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
