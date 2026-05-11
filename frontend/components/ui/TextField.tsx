import type { ReactNode } from "react";
import { Box, Field, Input, InputGroup, type InputProps } from "@chakra-ui/react";

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
  const input = (
    <Input
      bg="bg.field"
      borderColor="border.subtle"
      rounded="field"
      h="48px"
      px={4}
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
          fontSize="xs"
          fontWeight="semibold"
          color="fg.muted"
          textTransform={uppercase ? "uppercase" : "none"}
          letterSpacing="0.08em"
          mb={2}
        >
          {label}
        </Field.Label>
      )}
      {startElement || endElement ? (
        <InputGroup
          startElement={
            startElement && (
              <Box color="fg.muted" fontSize="md">
                {startElement}
              </Box>
            )
          }
          endElement={
            endElement && (
              <Box color="fg.muted" fontSize="md">
                {endElement}
              </Box>
            )
          }
        >
          {input}
        </InputGroup>
      ) : (
        input
      )}
      {helperText && !errorText && (
        <Field.HelperText fontSize="xs" color="fg.muted">
          {helperText}
        </Field.HelperText>
      )}
      {errorText && (
        <Field.ErrorText fontSize="xs">{errorText}</Field.ErrorText>
      )}
    </Field.Root>
  );
}