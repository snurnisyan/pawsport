import { type ReactNode } from "react";
import { HStack, Icon, Stack, Text } from "@chakra-ui/react";

type TFieldRowProps = {
  icon: ReactNode;
  label: string;
  children: ReactNode;
};

export function FieldRow({ icon, label, children }: TFieldRowProps) {
  return (
    <HStack gap="12px" align="flex-start">
      <Icon color="fg.muted" mt="2px">
        {icon}
      </Icon>
      <Stack gap="4px" flex={1} minW={0}>
        <Text
          fontSize="11px"
          fontWeight={700}
          color="fg.muted"
          textTransform="uppercase"
          letterSpacing="0.08em"
        >
          {label}
        </Text>
        {typeof children === "string" ? (
          <Text fontSize="14px" color="fg.default">
            {children}
          </Text>
        ) : (
          children
        )}
      </Stack>
    </HStack>
  );
}
