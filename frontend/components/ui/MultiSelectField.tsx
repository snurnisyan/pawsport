import {
  Box,
  Checkbox,
  HStack,
  Icon,
  Popover,
  Portal,
  Stack,
  Text,
} from "@chakra-ui/react";
import { LuChevronDown } from "react-icons/lu";
import { Pressable } from "@/components/ui/Pressable";

export type TMultiSelectOption = {
  value: string;
  label: string;
  color?: string;
};

type TMultiSelectFieldProps = {
  triggerLabel: string;
  options: TMultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  allLabel?: string;
};

export function MultiSelectField({ triggerLabel,
                                   options,
                                   selected,
                                   onChange,
                                   allLabel = "Все" }: TMultiSelectFieldProps) {
  const isAll = selected.length === 0 || selected.length === options.length;
  const displayText = isAll ? allLabel : `${selected.length}`;

  const toggle = (value: string, checked: boolean) => {
    if (checked) onChange([...selected.filter((v) => v !== value), value]);
    else onChange(selected.filter((v) => v !== value));
  };

  return (
    <Popover.Root positioning={{ placement: "bottom-start" }}>
      <Popover.Trigger asChild>
        <Pressable
          type="button"
          bg="bg.field"
          borderWidth="1px"
          borderColor="border.subtle"
          rounded="field"
          h="48px"
          w="full"
          px="16px"
          color="fg.default"
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          cursor="pointer"
          _hover={{ borderColor: "border.default" }}
        >
          <Text fontSize="14px" color={"fg.muted"}>
            {triggerLabel}:
          </Text>
          <Text>
            {displayText}
          </Text>
          <Icon color="fg.muted">
            <LuChevronDown />
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
            p="12px"
            minW="240px"
          >
            <Stack gap="10px">
              {options.map((o) => (
                <Checkbox.Root
                  key={o.value}
                  checked={selected.includes(o.value)}
                  onCheckedChange={(d) => toggle(o.value, Boolean(d.checked))}
                  colorPalette="blue"
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                  <Checkbox.Label>
                    <HStack gap="8px">
                      {o.color && (
                        <Box w="8px" h="8px" rounded="full" bg={o.color} />
                      )}
                      <Text fontSize="14px">{o.label}</Text>
                    </HStack>
                  </Checkbox.Label>
                </Checkbox.Root>
              ))}
            </Stack>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
