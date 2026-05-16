import { HStack, Text, VStack } from "@chakra-ui/react";
import { LuArrowRight } from "react-icons/lu";
import { PetForm, type TPetFormData } from "@/components/pets/PetForm";
import { PrimaryButton } from "@/components/ui/Buttons";
import { StepProgress } from "@/components/ui/StepProgress";

export type { TPetFormData as TPetData };

type TPetStepProps = {
  data: TPetFormData;
  onChange: (patch: Partial<TPetFormData>) => void;
  onNext: () => void;
};

export function PetStep({ data, onChange, onNext }: TPetStepProps) {
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

      <PrimaryButton onClick={onNext}>
        <HStack gap="8px">
          <Text>Далее</Text>
          <LuArrowRight />
        </HStack>
      </PrimaryButton>
    </VStack>
  );
}
