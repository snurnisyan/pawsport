import {
  Icon,
  Popover,
  Portal,
  Stack,
  Text,
} from "@chakra-ui/react";
import { LuCalendar } from "react-icons/lu";
import { Pressable } from "@/components/ui/Pressable";
import { GhostButton } from "@/components/ui/Buttons";
import { DateInput } from "@/components/ui/DateInput";

export type TDateRange = {
  from: string;
  to: string;
};

const pad = (n: number) => String(n).padStart(2, "0");

const formatShort = (dateStr: string) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
};

type TDateRangeFieldProps = {
  triggerLabel?: string;
  value: TDateRange;
  onChange: (value: TDateRange) => void;
};

export function DateRangeField({ triggerLabel = "Период",
                                  value,
                                  onChange }: TDateRangeFieldProps) {
  const hasValue = value.from || value.to;
  const display = !hasValue
    ? triggerLabel
    : `${formatShort(value.from) || "…"} — ${formatShort(value.to) || "…"}`;

  return (
    <Popover.Root positioning={{ placement: "bottom-end" }} autoFocus={false}>
      <Popover.Trigger asChild>
        <Pressable
          type="button"
          bg="bg.field"
          borderWidth="1px"
          borderColor="border.subtle"
          rounded="field"
          h="48px"
          w="full"
          ps="44px"
          pe="16px"
          position="relative"
          color={hasValue ? "fg.default" : "fg.muted"}
          display="flex"
          alignItems="center"
          cursor="pointer"
          _hover={{ borderColor: "border.default" }}
        >
          <Text fontSize="14px">{display}</Text>
          <Icon
            position="absolute"
            left="16px"
            top="50%"
            transform="translateY(-50%)"
            color="fg.muted"
          >
            <LuCalendar />
          </Icon>
        </Pressable>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            bg="bg.surface"
            borderColor="border.subtle"
            borderWidth="1px"
            rounded="card"
            shadow="card"
            p="16px"
            minW="280px"
          >
            <Stack gap="12px">
              <DateInput
                label="От"
                value={value.from}
                onChange={(from) => onChange({ from, to: value.to })}
              />
              <DateInput
                label="До"
                value={value.to}
                onChange={(to) => onChange({ from: value.from, to })}
              />
              {hasValue && (
                <GhostButton h="36px" onClick={() => onChange({ from: "", to: "" })}>
                  Сбросить
                </GhostButton>
              )}
            </Stack>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
