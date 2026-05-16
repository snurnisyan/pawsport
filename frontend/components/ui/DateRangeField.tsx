import {
  Field,
  Icon,
  Input,
  Popover,
  Portal,
  Stack,
  Text,
} from "@chakra-ui/react";
import { LuCalendar } from "react-icons/lu";
import { Pressable } from "@/components/ui/Pressable";
import { GhostButton } from "@/components/ui/Buttons";

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
    <Popover.Root positioning={{ placement: "bottom-end" }}>
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
          <Icon
            position="absolute"
            left="16px"
            top="50%"
            transform="translateY(-50%)"
            color="fg.muted"
          >
            <LuCalendar />
          </Icon>
          <Text fontSize="14px">{display}</Text>
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
              <Field.Root>
                <Field.Label
                  fontSize="11px"
                  fontWeight={700}
                  color="fg.muted"
                  textTransform="uppercase"
                  letterSpacing="0.08em"
                  mb="6px"
                >
                  От
                </Field.Label>
                <Input
                  type="date"
                  value={value.from}
                  onChange={(e) => onChange({ from: e.target.value, to: value.to })}
                  bg="bg.field"
                  borderColor="border.subtle"
                  rounded="field"
                  h="40px"
                  px="12px"
                  color="fg.default"
                  _focusVisible={{ borderColor: "primary.500", boxShadow: "glowSoft" }}
                />
              </Field.Root>
              <Field.Root>
                <Field.Label
                  fontSize="11px"
                  fontWeight={700}
                  color="fg.muted"
                  textTransform="uppercase"
                  letterSpacing="0.08em"
                  mb="6px"
                >
                  До
                </Field.Label>
                <Input
                  type="date"
                  value={value.to}
                  onChange={(e) => onChange({ from: value.from, to: e.target.value })}
                  bg="bg.field"
                  borderColor="border.subtle"
                  rounded="field"
                  h="40px"
                  px="12px"
                  color="fg.default"
                  _focusVisible={{ borderColor: "primary.500", boxShadow: "glowSoft" }}
                />
              </Field.Root>
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
