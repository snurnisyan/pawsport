import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Box, Field, Icon, Input, InputGroup } from "@chakra-ui/react";
import { LuCalendar } from "react-icons/lu";

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
  const year = Number(m[3]);
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
  const [text, setText] = useState<string>(() => isoToRu(value));
  const pickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(isoToRu(value));
  }, [value]);

  const handleTextChange = (e: ChangeEvent<HTMLInputElement>) => {
    const masked = maskInput(e.target.value);
    setText(masked);
    const iso = ruToIso(masked);
    if (iso) {
      onChange(iso);
    } else if (masked === "") {
      onChange("");
    }
  };

  const handlePickerChange = (e: ChangeEvent<HTMLInputElement>) => {
    const iso = e.target.value;
    onChange(iso);
    setText(isoToRu(iso));
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
            <Box
              as="button"
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
            </Box>
          }
        >
          <Input
            type="text"
            inputMode="numeric"
            placeholder={placeholder}
            value={text}
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
