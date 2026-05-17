import type { ReactNode } from "react";
import { Box, Text, VStack } from "@chakra-ui/react";
import { Pressable } from "@/components/ui/Pressable";

type TChoiceCardProps = {
  selected?: boolean;
  onSelect?: () => void;
  icon?: ReactNode;
  label: string;
  fullWidth?: boolean;
};

export function ChoiceCard({ selected,
                             onSelect,
                             icon,
                             label,
                             fullWidth }: TChoiceCardProps) {
  return (
    <Pressable
      type="button"
      onClick={onSelect}
      flex={fullWidth ? 1 : undefined}
      minW="100px"
      bg="bg.surface"
      borderWidth="1px"
      borderColor={selected ? "primary.500" : "border.subtle"}
      rounded="card"
      px="20px"
      py="20px"
      cursor="pointer"
      transition="all 0.15s"
      boxShadow={selected ? "glowSoft" : "none"}
      _hover={{ borderColor: selected ? "primary.500" : "border.default" }}
    >
      <VStack gap="8px">
        {icon && (
          <Box fontSize="24px" color={selected ? "primary.400" : "fg.muted"}>
            {icon}
          </Box>
        )}
        <Text
          fontSize="12px"
          fontWeight={700}
          letterSpacing="0.08em"
          textTransform="uppercase"
          color={selected ? "fg.default" : "fg.muted"}
        >
          {label}
        </Text>
      </VStack>
    </Pressable>
  );
}
