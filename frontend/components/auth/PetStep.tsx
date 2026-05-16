import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import { LuArrowRight } from "react-icons/lu";
import { PetForm, type TPetFormData } from "@/components/pets/PetForm";
import { PrimaryButton } from "@/components/ui/Buttons";
import { StepProgress } from "@/components/ui/StepProgress";

export type { TPetFormData as TPetData };

type TPetStepProps = {
  data: TPetFormData;
  onChange: (patch: Partial<TPetFormData>) => void;
  isSubmitting?: boolean;
  errorText?: string;
  onNext: () => void;
};

export function PetStep({
  data,
  onChange,
  isSubmitting = false,
  errorText,
  onNext,
}: TPetStepProps) {
  const canSubmit = Boolean(data.name.trim() && data.species && !isSubmitting);

  return (
    <VStack gap="32px" align="stretch" w="full" maxW="640px" mx="auto">
      <VStack gap="8px" align="center">
        <StepProgress current={2} total={3} />
        <Text fontSize={["30px", null, "36px"]} fontWeight={700} mt="24px">
          Первый питомец
        </Text>
        <Text color="fg.muted">Коротко расскажи о своем питомце</Text>
      </VStack>

      <PetForm data={data} onChange={onChange} />

      {errorText && (
        <Box
          bg="red.950"
          borderWidth="1px"
          borderColor="red.700"
          color="red.100"
          rounded="field"
          px="14px"
          py="10px"
        >
          <Text fontSize="13px">{errorText}</Text>
        </Box>
      )}

      <PrimaryButton onClick={onNext} disabled={!canSubmit} loading={isSubmitting}>
        <HStack gap="8px">
          <Text>Далее</Text>
          <LuArrowRight />
        </HStack>
      </PrimaryButton>
    </VStack>
  );
}
