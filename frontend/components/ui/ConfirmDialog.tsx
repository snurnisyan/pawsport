import { HStack, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { GhostButton, PrimaryButton } from "@/components/ui/Buttons";
import { DialogShell } from "@/components/ui/DialogShell";

type TConfirmDialogProps = {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isPending?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Удалить",
  cancelLabel = "Отмена",
  isPending = false,
  onOpenChange,
  onConfirm,
}: TConfirmDialogProps) {
  return (
    <DialogShell
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending) onOpenChange(nextOpen);
      }}
      title={title}
      footer={
        <HStack gap="12px" w="full">
          <GhostButton
            flex={1}
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {cancelLabel}
          </GhostButton>
          <PrimaryButton
            flex={1}
            onClick={onConfirm}
            disabled={isPending}
            bg="red.500"
            boxShadow="none"
            _hover={{ bg: "red.600", boxShadow: "none" }}
            _active={{ bg: "red.700" }}
          >
            {confirmLabel}
          </PrimaryButton>
        </HStack>
      }
      size="sm"
    >
      {description && (
        <Stack gap="8px">
          <Text color="fg.muted">{description}</Text>
        </Stack>
      )}
    </DialogShell>
  );
}
