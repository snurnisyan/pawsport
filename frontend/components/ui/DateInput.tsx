import { useRef, useState, type ChangeEvent } from "react";
import { Box, Field, Icon, Input, InputGroup, chakra } from "@chakra-ui/react";
import { LuCalendar } from "react-icons/lu";

const CalendarButton = chakra("button");

const isoToRu = (iso: string): string => {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  return `${m[3]}.${m[2]}.${m[1]}`;
};

const ruToIso = (ru: string): string => {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(ru.trim());
  if (!m) return "";
  const day = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
};

const maskInput = (raw: string): string => {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
};

type TDateInputProps = {
  label?: string;
  value: string;
  onChange: (iso: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  uppercase?: boolean;
};

export function DateInput({
  label,
  value,
  onChange,
  readOnly,
  placeholder = "дд.мм.гггг",
  uppercase = true,
}: TDateInputProps) {
  const [inputState, setInputState] = useState(() => ({
    value,
    text: isoToRu(value),
  }));
  const pickerRef = useRef<HTMLInputElement>(null);

  if (inputState.value !== value) {
    setInputState({ value, text: isoToRu(value) });
  }

  const handleTextChange = (e: ChangeEvent<HTMLInputElement>) => {
    const masked = maskInput(e.target.value);
    const iso = ruToIso(masked);
    setInputState({ value: iso || value, text: masked });
    if (iso) {
      onChange(iso);
    } else if (masked === "") {
      onChange("");
    }
  };

  const handlePickerChange = (e: ChangeEvent<HTMLInputElement>) => {
    const iso = e.target.value;
    onChange(iso);
    setInputState({ value: iso, text: isoToRu(iso) });
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
            <CalendarButton
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
              aria-label="Открыть календарь"
            >
              <Icon>
                <LuCalendar />
              </Icon>
            </CalendarButton>
          }
        >
          <Input
            type="text"
            lang="ru"
            inputMode="numeric"
            placeholder={placeholder}
            value={inputState.text}
            onChange={handleTextChange}
            readOnly={readOnly}
            bg="bg.field"
            borderColor="border.subtle"
            rounded="field"
            h="48px"
            ps="16px"
            pe="44px"
            color="fg.default"
            _placeholder={{ color: "fg.muted" }}
            _hover={{ borderColor: "border.default" }}
            _focusVisible={{
              borderColor: "primary.500",
              boxShadow: "glowSoft",
            }}
          />
        </InputGroup>
        <Input
          ref={pickerRef}
          type="date"
          lang="ru"
          value={value}
          onChange={handlePickerChange}
          position="absolute"
          opacity={0}
          pointerEvents="none"
          right="12px"
          bottom="0"
          w="0"
          h="0"
          tabIndex={-1}
          aria-hidden
        />
      </Box>
    </Field.Root>
  );
}
