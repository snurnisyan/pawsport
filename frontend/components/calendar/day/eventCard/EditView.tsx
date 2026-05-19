import { HStack, Stack } from "@chakra-ui/react";
import { GhostButton, PrimaryButton } from "@/components/ui/Buttons";
import {
  EventForm,
  type TEventFormData,
  type TExistingEventFile,
  type TPetOption,
} from "@/components/pets/events/EventForm";
import { isEventSubtypeSupported } from "@/lib/eventTypes";

type TEditViewProps = {
  data: TEventFormData;
  onChange: (patch: Partial<TEventFormData>) => void;
  onCancel: () => void;
  onSave: () => void;
  pets: TPetOption[];
  saveLabel: string;
  existingFiles?: TExistingEventFile[];
  onRemoveExistingFile?: (fileId: string) => void;
  isPending?: boolean;
};

export function EditView({
  data,
  onChange,
  onCancel,
  onSave,
  pets,
  saveLabel,
  existingFiles,
  onRemoveExistingFile,
  isPending,
}: TEditViewProps) {
  const subtypeMissing = isEventSubtypeSupported(data.type) && !data.subtype;
  const disabled =
    Boolean(isPending) || !data.title.trim() || !data.type || !data.petId || subtypeMissing;
  return (
    <Stack gap="20px" px="16px" pb="16px" pt="8px">
      <EventForm
        data={data}
        onChange={onChange}
        pets={pets.length > 0 ? pets : undefined}
        existingFiles={existingFiles}
        onRemoveExistingFile={onRemoveExistingFile}
      />
      <HStack gap="12px" pt="4px">
        <GhostButton flex={1} onClick={onCancel} disabled={isPending}>
          Отменить
        </GhostButton>
        <PrimaryButton flex={1} onClick={onSave} disabled={disabled}>
          {saveLabel}
        </PrimaryButton>
      </HStack>
    </Stack>
  );
}
