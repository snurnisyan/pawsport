import { useRef, type ChangeEvent } from "react";
import { Box, Field, Icon, Input, InputGroup, chakra } from "@chakra-ui/react";
import { LuClock } from "react-icons/lu";

const ClockButton = chakra("button");

type TTimeInputProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  uppercase?: boolean;
};

export function TimeInput({
  label,
  value,
  onChange,
  readOnly,
  placeholder = "чч:мм",
  uppercase = true,
}: TTimeInputProps) {
  const pickerRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const openPicker = () => {
    if (readOnly) return;
    const el = pickerRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      el.showPicker();
    } else {
      el.focus();
      el.click();
    }
  };

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
        <InputGroup
          endElementProps={{ ps: "8px", pe: "12px", color: "fg.muted", fontSize: "16px" }}
          endElement={
            <ClockButton
              type="button"
              onClick={openPicker}
              cursor={readOnly ? "default" : "pointer"}
              color="fg.muted"
              display="inline-flex"
              alignItems="center"
              justifyContent="center"
              p="4px"
              rounded="sm"
              _hover={readOnly ? undefined : { color: "fg.default" }}
              aria-label="Открыть выбор времени"
            >
              <Icon>
                <LuClock />
              </Icon>
            </ClockButton>
          }
        >
          <Input
            ref={pickerRef}
            type="time"
            lang="ru"
            placeholder={placeholder}
            value={value}
            onChange={handleChange}
            readOnly={readOnly}
            bg="bg.field"
            borderColor="border.subtle"
            rounded="field"
            h="48px"
            ps="16px"
            pe="44px"
            color="fg.default"
            css={{
              "&::-webkit-calendar-picker-indicator": {
                display: "none",
                WebkitAppearance: "none",
              },
              "&::-webkit-time-picker-indicator": {
                display: "none",
              },
            }}
            _placeholder={{ color: "fg.muted" }}
            _hover={{ borderColor: "border.default" }}
            _focusVisible={{
              borderColor: "primary.500",
              boxShadow: "glowSoft",
            }}
          />
        </InputGroup>
      </Box>
    </Field.Root>
  );
}
