import { Box, Field, Icon, chakra } from "@chakra-ui/react";
import { LuChevronDown } from "react-icons/lu";

type TSelectOption = { value: string; label: string };

type TSelectFieldProps = {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  options: TSelectOption[];
  placeholder?: string;
  uppercase?: boolean;
  disabled?: boolean;
};

const StyledSelect = chakra("select");

export function SelectField({ label,
                              value,
                              onChange,
                              options,
                              placeholder,
                              uppercase = true,
                              disabled = false }: TSelectFieldProps) {
  return (
    <Field.Root>
      {label && (
        <Field.Label
          fontSize="12px"
          fontWeight={600}
          color="fg.muted"
          textTransform={uppercase ? "uppercase" : "none"}
          letterSpacing="0.08em"
          mb="8px"
        >
          {label}
        </Field.Label>
      )}
      <Box position="relative" w="full">
        <StyledSelect
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          bg="bg.field"
          borderWidth="1px"
          borderColor="border.subtle"
          borderStyle="solid"
          rounded="field"
          h="48px"
          w="full"
          pl="16px"
          pr="44px"
          color={value ? "fg.default" : "fg.muted"}
          fontSize="14px"
          appearance="none"
          cursor={disabled ? "default" : "pointer"}
          outline="none"
          _hover={{ borderColor: "border.default" }}
          _focusVisible={{
            borderColor: "primary.500",
            boxShadow: "glowSoft",
          }}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </StyledSelect>
        <Icon
          position="absolute"
          right="16px"
          top="50%"
          transform="translateY(-50%)"
          color="fg.muted"
          pointerEvents="none"
        >
          <LuChevronDown />
        </Icon>
      </Box>
    </Field.Root>
  );
}
