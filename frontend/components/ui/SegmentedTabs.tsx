import { Box, HStack, Text } from "@chakra-ui/react";
import { Pressable } from "@/components/ui/Pressable";

export type TSegmentedTab = {
  value: string;
  label: string;
};

type TSegmentedTabsProps = {
  tabs: TSegmentedTab[];
  value: string;
  onChange: (value: string) => void;
};

export function SegmentedTabs({ tabs, value, onChange }: TSegmentedTabsProps) {
  return (
    <Box
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.subtle"
      rounded="full"
      p={1}
      overflowX="auto"
    >
      <HStack gap={1} minW="max-content">
        {tabs.map((tab) => {
          const active = tab.value === value;
          return (
            <Pressable
              key={tab.value}
              type="button"
              onClick={() => onChange(tab.value)}
              px={{ base: 5, md: 8 }}
              py={2.5}
              rounded="full"
              bg={active ? "primary.500" : "transparent"}
              boxShadow={active ? "glowSoft" : "none"}
              cursor="pointer"
              transition="all 0.15s"
              _hover={!active ? { bg: "secondary.700" } : undefined}
              flex={1}
            >
              <Text
                fontSize="sm"
                fontWeight={active ? "semibold" : "medium"}
                color={active ? "white" : "fg.muted"}
                whiteSpace="nowrap"
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </HStack>
    </Box>
  );
}
