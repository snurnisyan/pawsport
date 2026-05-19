import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DialogActions } from "@/components/ui/DialogActions";
import { DialogShell } from "@/components/ui/DialogShell";
import { PetForm, type TPetFormData } from "@/components/pets/PetForm";
import { toaster } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api";
import { createPet, petsQueryKey } from "@/lib/petsApi";

const INITIAL: TPetFormData = {
  name: "",
  species: null,
  breed: "",
  sex: null,
  photo: null,
};

type TAddPetDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddPetDialog({ open, onOpenChange }: TAddPetDialogProps) {
  const [data, setData] = useState<TPetFormData>(INITIAL);
  const queryClient = useQueryClient();

  const closeDialog = () => {
    setData(INITIAL);
    onOpenChange(false);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      createPet({
        name: data.name.trim(),
        species: data.species ?? "",
        breed: data.breed.trim() || undefined,
        sex: data.sex ?? "unknown",
        tags: [],
        notes: [],
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: petsQueryKey });
      toaster.success({ title: "Питомец добавлен" });
      closeDialog();
    },
    onError: (error) => {
      toaster.error({
        title: "Не удалось добавить питомца",
        description:
          error instanceof ApiError ? error.message : "Попробуйте еще раз.",
      });
    },
  });

  return (
    <DialogShell
      open={open}
      onOpenChange={(nextOpen) => {
        if (createMutation.isPending) return;
        if (!nextOpen) {
          closeDialog();
          return;
        }
        onOpenChange(true);
      }}
      title="Новый питомец"
      subtitle="Коротко расскажи о своем питомце"
      footer={
        <DialogActions
          onCancel={closeDialog}
          onSave={() => createMutation.mutate()}
          saveLabel="Добавить"
          saveDisabled={
            !data.name.trim() || !data.species || createMutation.isPending
          }
        />
      }
    >
      <PetForm
        data={data}
        onChange={(patch) => setData((d) => ({ ...d, ...patch }))}
      />
    </DialogShell>
  );
}
