import { useEffect, useState } from "react";
import { DialogActions } from "@/components/ui/DialogActions";
import { DialogShell } from "@/components/ui/DialogShell";
import { PetForm, type TPetFormData } from "@/components/pets/PetForm";

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
  onSubmit?: (data: TPetFormData) => void;
};

export function AddPetDialog({ open, onOpenChange, onSubmit }: TAddPetDialogProps) {
  const [data, setData] = useState<TPetFormData>(INITIAL);

  useEffect(() => {
    if (!open) setData(INITIAL);
  }, [open]);

  const handleSave = () => {
    onSubmit?.(data);
    onOpenChange(false);
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Новый питомец"
      subtitle="Коротко расскажи о своем питомце"
      footer={
        <DialogActions
          onCancel={() => onOpenChange(false)}
          onSave={handleSave}
          saveLabel="Добавить"
          saveDisabled={!data.name.trim() || !data.species}
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
