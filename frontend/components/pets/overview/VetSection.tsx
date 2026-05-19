import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { HStack, Stack, Text } from "@chakra-ui/react";
import { LuMail, LuPhone, LuStethoscope } from "react-icons/lu";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { toaster } from "@/components/ui/toaster";
import {
  petQueryKey,
  petsQueryKey,
  updatePet,
  type TPetResponse,
} from "@/lib/petsApi";
import type { TPet } from "@/store/pets";
import { apiErrorMessage } from "@/utils/apiErrorMessage";
import { FormActions } from "./FormActions";
import { SectionCardHeader } from "./SectionCardHeader";

type TVetSectionProps = {
  vet?: TPet["vet"];
  backendPetId?: string;
};

type TVetFormSource = Partial<NonNullable<TPet["vet"]>>;

type TVetForm = {
  name: string;
  phone: string;
  email: string;
};

const SAVE_ERROR = "Не удалось сохранить изменения. Проверьте поля и попробуйте еще раз.";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const buildForm = (vet?: TVetFormSource): TVetForm => ({
  name: vet?.name ?? "",
  phone: vet?.phone ?? "",
  email: vet?.email ?? "",
});

export function VetSection({ vet, backendPetId }: TVetSectionProps) {
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();
  const {
    formState: { errors },
    control,
    handleSubmit,
    register,
    reset,
  } = useForm<TVetForm>({
    defaultValues: buildForm(vet),
  });
  const form = useWatch({ control }) as TVetForm;
  const hasVetContact = Boolean(
    form.name.trim() || form.phone.trim() || form.email.trim()
  );

  useEffect(() => {
    reset(buildForm(vet));
  }, [vet, reset]);

  const mutation = useMutation({
    mutationFn: (values: TVetForm) => {
      if (!backendPetId) throw new Error(SAVE_ERROR);

      const trimmed = {
        name: values.name.trim(),
        phone: values.phone.trim(),
        email: values.email.trim(),
      };
      const vetContact =
        trimmed.name || trimmed.phone || trimmed.email
          ? {
              ...(trimmed.name ? { name: trimmed.name } : {}),
              ...(trimmed.phone ? { phone: trimmed.phone } : {}),
              ...(trimmed.email ? { email: trimmed.email } : {}),
            }
          : null;

      return updatePet(backendPetId, { vetContact });
    },
    onSuccess: async (response) => {
      if (backendPetId) {
        queryClient.setQueryData<TPetResponse>(petQueryKey(backendPetId), response);
      }
      await queryClient.invalidateQueries({ queryKey: petsQueryKey });
      reset(buildForm(response.pet.vetContact));
      setEditing(false);
    },
    onError: (error) => {
      toaster.error({
        title: "Не удалось сохранить ветеринара",
        description: apiErrorMessage(error, SAVE_ERROR),
      });
    },
  });

  const save = handleSubmit((values) => {
    if (!backendPetId) {
      setEditing(false);
      return;
    }
    mutation.mutate(values);
  });

  return (
    <Card>
      <SectionCardHeader
        icon={<LuStethoscope />}
        title="Ветеринар"
        editing={editing}
        onEditClick={() => setEditing(true)}
      />
      <Stack gap="12px">
        {!editing && !hasVetContact ? (
          <Text fontSize="14px" color="fg.muted">
            Ветеринар не указан
          </Text>
        ) : (
          <TextField
            value={form.name}
            readOnly={!editing}
            placeholder="Имя ветеринара"
            {...register("name")}
          />
        )}
        {editing ? (
          <>
            <TextField
              value={form.phone}
              startElement={<LuPhone />}
              placeholder="+7 912 345-67-89"
              {...register("phone")}
            />
            <TextField
              value={form.email}
              type="email"
              startElement={<LuMail />}
              placeholder="doctor@example.com"
              errorText={errors.email?.message}
              {...register("email", {
                validate: (value) =>
                  !value.trim() ||
                  EMAIL_RE.test(value.trim()) ||
                  "Введите корректный email.",
              })}
            />
            <FormActions
              onSave={save}
              onCancel={() => {
                reset(buildForm(vet));
                setEditing(false);
              }}
              isSaving={mutation.isPending}
            />
          </>
        ) : (
          hasVetContact && (
            <>
              {form.phone.trim() && (
                <HStack color="fg.muted" fontSize="14px" gap="8px">
                  <LuPhone />
                  <Text>{form.phone}</Text>
                </HStack>
              )}
              {form.email.trim() && (
                <HStack color="fg.muted" fontSize="14px" gap="8px">
                  <LuMail />
                  <Text>{form.email}</Text>
                </HStack>
              )}
            </>
          )
        )}
      </Stack>
    </Card>
  );
}
