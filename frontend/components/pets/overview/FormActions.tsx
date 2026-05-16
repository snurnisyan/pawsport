import { HStack } from "@chakra-ui/react";
import { GhostButton, PrimaryButton } from "@/components/ui/Buttons";

type TFormActionsProps = {
  onSave: () => void;
  onCancel: () => void;
};

export function FormActions({ onSave, onCancel }: TFormActionsProps) {
  return (
    <HStack gap="12px" pt="8px">
      <GhostButton flex={1} onClick={onCancel}>
        Отменить
      </GhostButton>
      <PrimaryButton flex={1} onClick={onSave}>
        Сохранить
      </PrimaryButton>
    </HStack>
  );
}
