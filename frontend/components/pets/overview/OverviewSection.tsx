import { useEffect, useState, type ChangeEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import {
  Box,
  Field,
  Grid,
  HStack,
  Icon,
  Input,
  Stack,
  chakra,
} from "@chakra-ui/react";
import { LuChevronDown, LuUser } from "react-icons/lu";
import { Card } from "@/components/ui/Card";
import { DateInput } from "@/components/ui/DateInput";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { toaster } from "@/components/ui/toaster";
import { toPetViewModel } from "@/lib/petViewModel";
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

type TOverviewSectionProps = {
  pet: TPet;
  backendPetId?: string;
};

type TFormSex = "male" | "female" | "unspecified";
type TWeightUnit = "kg" | "g";

type TOverviewForm = {
  chipNumber: string;
  birthDate: string;
  sex: TFormSex;
  weightValue: string;
  weightUnit: TWeightUnit;
  breed: string;
};

const SEX_OPTIONS = [
  { value: "male", label: "Мужской" },
  { value: "female", label: "Женский" },
  { value: "unspecified", label: "Не указано" },
];

const SAVE_ERROR = "Не удалось сохранить изменения. Проверьте поля и попробуйте еще раз.";
const StyledSelect = chakra("select");

const buildForm = (pet: TPet): TOverviewForm => ({
  chipNumber: pet.chipNumber ?? "",
  birthDate: pet.birthDate ?? "",
  sex: pet.sex === "unknown" ? "unspecified" : pet.sex,
  weightValue: pet.weightKg > 0 ? String(pet.weightKg).replace(".", ",") : "",
  weightUnit: "kg",
  breed: pet.breed === "—" ? "" : pet.breed,
});

const normalizeWeight = (value: string, unit: TWeightUnit): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(parsed)) return null;

  return unit === "g" ? parsed / 1000 : parsed;
};

export function OverviewSection({ pet, backendPetId }: TOverviewSectionProps) {
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();
  const {
    formState: { errors },
    handleSubmit,
    control,
    register,
    reset,
    setValue,
  } = useForm<TOverviewForm>({
    defaultValues: buildForm(pet),
  });
  const form = useWatch({ control }) as TOverviewForm;

  useEffect(() => {
    reset(buildForm(pet));
  }, [pet, reset]);

  const mutation = useMutation({
    mutationFn: (values: TOverviewForm) => {
      if (!backendPetId) throw new Error(SAVE_ERROR);

      const microchipNumber = values.chipNumber.replace(/[\s#]/g, "");
      return updatePet(backendPetId, {
        breed: values.breed.trim() || null,
        birthDate: values.birthDate || null,
        sex: values.sex === "unspecified" ? "unknown" : values.sex,
        weight: normalizeWeight(values.weightValue, values.weightUnit),
        microchipNumber: microchipNumber || null,
      });
    },
    onSuccess: async (response) => {
      if (backendPetId) {
        queryClient.setQueryData<TPetResponse>(petQueryKey(backendPetId), response);
      }
      await queryClient.invalidateQueries({ queryKey: petsQueryKey });
      reset(buildForm(toPetViewModel(response.pet)));
      setEditing(false);
    },
    onError: (error) => {
      toaster.error({
        title: "Не удалось сохранить обзор",
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

  const handleWeightChange = (e: ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value
      .replace(/[^\d.,]/g, "")
      .replace(/[.,]+/g, ",")
      .replace(/^(\d*,\d*),.*/, "$1");
    setValue("weightValue", cleaned, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <Card>
      <SectionCardHeader
        icon={<LuUser />}
        title="Обзор"
        editing={editing}
        onEditClick={() => setEditing(true)}
      />
      <Stack gap="16px">
        <Grid templateColumns={["1fr", "1fr 1fr"]} gap="16px">
          <TextField
            label="Номер чипа"
            value={form.chipNumber}
            readOnly={!editing}
            errorText={errors.chipNumber?.message}
            {...register("chipNumber", {
              validate: (value) => {
                const normalized = value.replace(/[\s#]/g, "");
                return (
                  !normalized ||
                  /^\d{15}$/.test(normalized) ||
                  "Номер чипа должен содержать ровно 15 цифр."
                );
              },
            })}
          />
          <DateInput
            label="Дата рождения"
            value={form.birthDate}
            readOnly={!editing}
            onChange={(birthDate) =>
              setValue("birthDate", birthDate, { shouldDirty: true })
            }
          />
          <SelectField
            label="Пол"
            options={SEX_OPTIONS}
            value={form.sex}
            disabled={!editing}
            onChange={(value) =>
              setValue("sex", value as TFormSex, { shouldDirty: true })
            }
          />
          <Field.Root invalid={Boolean(errors.weightValue)}>
            <Field.Label
              fontSize="12px"
              fontWeight={600}
              color="fg.muted"
              textTransform="uppercase"
              letterSpacing="0.08em"
              mb="8px"
            >
              Вес
            </Field.Label>
            <HStack
              gap="0"
              bg="bg.field"
              borderWidth="1px"
              borderColor="border.subtle"
              rounded="field"
              h="48px"
              w="full"
              _focusWithin={{
                borderColor: "primary.500",
                boxShadow: "glowSoft",
              }}
              _hover={{ borderColor: "border.default" }}
            >
              <Input
                type="text"
                inputMode="decimal"
                value={form.weightValue}
                readOnly={!editing}
                placeholder="0"
                border="none"
                bg="transparent"
                h="full"
                flex={1}
                ps="16px"
                pe="8px"
                color="fg.default"
                _placeholder={{ color: "fg.muted" }}
                _focusVisible={{ boxShadow: "none", outline: "none" }}
                {...register("weightValue", {
                  onChange: handleWeightChange,
                  validate: (value) => {
                    const weight = normalizeWeight(value, form.weightUnit);
                    return (
                      weight === null ||
                      weight >= 0 ||
                      "Вес должен быть неотрицательным числом."
                    );
                  },
                })}
              />
              <Box
                position="relative"
                h="full"
                borderLeftWidth="1px"
                borderColor="border.subtle"
                pl="2px"
              >
                <StyledSelect
                  value={form.weightUnit}
                  onChange={(e) =>
                    setValue("weightUnit", e.target.value as TWeightUnit, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  disabled={!editing}
                  bg="transparent"
                  border="none"
                  h="full"
                  pl="14px"
                  pr="34px"
                  color="fg.default"
                  fontSize="14px"
                  appearance="none"
                  cursor={editing ? "pointer" : "default"}
                  outline="none"
                >
                  <option value="kg">кг</option>
                  <option value="g">г</option>
                </StyledSelect>
                <Icon
                  position="absolute"
                  right="12px"
                  top="50%"
                  transform="translateY(-50%)"
                  color="fg.muted"
                  pointerEvents="none"
                >
                  <LuChevronDown />
                </Icon>
              </Box>
            </HStack>
            {errors.weightValue?.message && (
              <Field.ErrorText fontSize="12px">
                {errors.weightValue.message}
              </Field.ErrorText>
            )}
          </Field.Root>
          <Box gridColumn={["auto", "1 / -1"]}>
            <TextField
              label="Порода"
              value={form.breed}
              readOnly={!editing}
              {...register("breed")}
            />
          </Box>
        </Grid>
        {editing && (
          <FormActions
            onSave={save}
            onCancel={() => {
              reset(buildForm(pet));
              setEditing(false);
            }}
            isSaving={mutation.isPending}
          />
        )}
      </Stack>
    </Card>
  );
}
