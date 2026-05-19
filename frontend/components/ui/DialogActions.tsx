import { HStack } from "@chakra-ui/react";
import { GhostButton, PrimaryButton } from "@/components/ui/Buttons";

type TDialogActionsProps = {
  onCancel: () => void;
  onSave: () => void | Promise<void>;
  cancelLabel?: string;
  saveLabel?: string;
  cancelDisabled?: boolean;
  saveDisabled?: boolean;
};

export function DialogActions({ onCancel,
                                onSave,
                                cancelLabel = "Закрыть",
                                saveLabel = "Сохранить",
                                cancelDisabled = false,
                                saveDisabled = false }: TDialogActionsProps) {
  return (
    <HStack gap="12px" w="full">
      <GhostButton flex={1} onClick={onCancel} disabled={cancelDisabled}>
        {cancelLabel}
      </GhostButton>
      <PrimaryButton flex={1} onClick={onSave} disabled={saveDisabled}>
        {saveLabel}
      </PrimaryButton>
    </HStack>
  );
}
