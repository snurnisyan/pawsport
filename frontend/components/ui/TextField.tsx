import type { ReactNode } from "react";
import { Field, Input, InputGroup, type InputProps } from "@chakra-ui/react";

type TTextFieldProps = InputProps & {
  label?: string;
  helperText?: string;
  errorText?: string;
  startElement?: ReactNode;
  endElement?: ReactNode;
  uppercase?: boolean;
};

export function TextField({ label,
                            helperText,
                            errorText,
                            startElement,
                            endElement,
                            uppercase = true,
                            ...inputProps }: TTextFieldProps) {
  const hasStart = Boolean(startElement);
  const hasEnd = Boolean(endElement);
  const input = (
    <Input
      bg="bg.field"
      borderColor="border.subtle"
      rounded="field"
      h="48px"
      ps={hasStart ? ["40px", "52px"] : "16px"}
      pe={hasEnd ? "52px" : "16px"}
      color="fg.default"
      _placeholder={{ color: "fg.muted" }}
      _hover={{ borderColor: "border.default" }}
      _focusVisible={{
        borderColor: "primary.500",
        boxShadow: "glowSoft",
      }}
      {...inputProps}
    />
  );
  return (
    <Field.Root invalid={Boolean(errorText)}>
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
      {hasStart || hasEnd ? (
        <InputGroup
          startElementProps={{ ps: "16px", pe: "8px", color: "fg.muted", fontSize: "16px" }}
          endElementProps={{ ps: "8px", pe: "16px", color: "fg.muted", fontSize: "16px" }}
          startElement={startElement}
          endElement={endElement}
        >
          {input}
        </InputGroup>
      ) : (
        input
      )}
      {helperText && !errorText && (
        <Field.HelperText fontSize="12px" color="fg.muted">
          {helperText}
        </Field.HelperText>
      )}
      {errorText && (
        <Field.ErrorText fontSize="12px">{errorText}</Field.ErrorText>
      )}
    </Field.Root>
  );
}
