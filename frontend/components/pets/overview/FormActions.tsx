import { HStack } from "@chakra-ui/react";
import { GhostButton, PrimaryButton } from "@/components/ui/Buttons";

type TFormActionsProps = {
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean;
  disabled?: boolean;
};

export function FormActions({
  onSave,
  onCancel,
  isSaving = false,
  disabled = false,
}: TFormActionsProps) {
  return (
    <HStack gap="12px" pt="8px">
      <GhostButton flex={1} onClick={onCancel} disabled={isSaving}>
        Отменить
      </GhostButton>
      <PrimaryButton
        flex={1}
        onClick={onSave}
        disabled={disabled || isSaving}
        loading={isSaving}
      >
        Сохранить
      </PrimaryButton>
    </HStack>
  );
}
