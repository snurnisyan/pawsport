import { Box, HStack, Text, VStack } from "@chakra-ui/react";

type TStepProgressProps = {
  current: number;
  total: number;
};

export function StepProgress({ current, total }: TStepProgressProps) {
  return (
    <VStack gap="12px" align="center" w="full">
      <Text
        fontSize="12px"
        fontWeight={700}
        letterSpacing="0.12em"
        color="fg.muted"
        textTransform="uppercase"
      >
        Шаг {current} из {total}
      </Text>
      <HStack gap="8px" w="full">
        {Array.from({ length: total }).map((_, i) => (
          <Box
            key={i}
            flex={1}
            h="6px"
            rounded="full"
            bg={i < current ? "fg.accent" : "secondary.500"}
          />
        ))}
      </HStack>
    </VStack>
  );
}
