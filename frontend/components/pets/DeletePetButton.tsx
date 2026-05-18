import { useState } from "react";
import { Button } from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LuTrash2 } from "react-icons/lu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toaster } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api";
import { deletePet, petQueryKey, petsQueryKey } from "@/lib/petsApi";

type TDeletePetButtonProps = {
  petName: string;
  petId?: string;
  onDeleted?: () => void;
};

export function DeletePetButton({ petName, petId, onDeleted }: TDeletePetButtonProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!petId) throw new Error("Не удалось удалить питомца. Попробуйте еще раз.");
      await deletePet(petId);
    },
    onSuccess: async () => {
      if (petId) {
        queryClient.removeQueries({ queryKey: petQueryKey(petId) });
      }
      await queryClient.invalidateQueries({ queryKey: petsQueryKey });
      setOpen(false);
      toaster.success({ title: "Питомец удален" });
      onDeleted?.();
    },
    onError: (error) => {
      toaster.error({
        title: "Не удалось удалить питомца",
        description:
          error instanceof ApiError
            ? error.message
            : "Попробуйте еще раз.",
      });
    },
  });

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
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </>
  );
}
