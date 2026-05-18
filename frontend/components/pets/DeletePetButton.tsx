import { useState } from "react";
import { Button } from "@chakra-ui/react";
import { LuTrash2 } from "react-icons/lu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type TDeletePetButtonProps = {
  petName: string;
  onConfirm?: () => void;
};

export function DeletePetButton({ petName, onConfirm }: TDeletePetButtonProps) {
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    onConfirm?.();
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="ghost"
        color="red.400"
        rounded="field"
        h="44px"
        px="20px"
        fontWeight={500}
        _hover={{ color: "red.300", bg: "secondary.700" }}
        onClick={() => setOpen(true)}
      >
        <LuTrash2 />
        Удалить питомца
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Удалить питомца?"
        description={`Вы уверены, что хотите удалить питомца ${petName}? Это действие нельзя отменить.`}
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        onConfirm={handleConfirm}
      />
    </>
  );
}
