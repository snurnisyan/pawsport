import { useState, type ChangeEvent } from "react";
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
import type { TPet } from "@/store/pets";
import { FormActions } from "./FormActions";
import { SectionCardHeader } from "./SectionCardHeader";

type TOverviewSectionProps = { pet: TPet };

type TFormSex = "male" | "female" | "unspecified";
type TWeightUnit = "kg" | "g";

const SEX_OPTIONS = [
  { value: "male", label: "Мужской" },
  { value: "female", label: "Женский" },
  { value: "unspecified", label: "Не указано" },
];

const StyledSelect = chakra("select");

const buildForm = (pet: TPet) => ({
  chipNumber: pet.chipNumber ?? "",
  birthDate: pet.birthDate ?? "",
  sex: (pet.sex as TFormSex) ?? "unspecified",
  weightValue:
    pet.weightKg > 0 ? String(pet.weightKg).replace(".", ",") : "",
  weightUnit: "kg" as TWeightUnit,
  breed: pet.breed,
});

const handleWeightChange =
  (setter: (updater: (f: ReturnType<typeof buildForm>) => ReturnType<typeof buildForm>) => void) =>
  (e: ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value
      .replace(/[^\d.,]/g, "")
      .replace(/[.,]+/g, ",")
      .replace(/^(\d*,\d*),.*/, "$1");
    setter((f) => ({ ...f, weightValue: cleaned }));
  };

export function OverviewSection({ pet }: TOverviewSectionProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => buildForm(pet));

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
            onChange={(e) => setForm((f) => ({ ...f, chipNumber: e.target.value }))}
          />
          <DateInput
            label="Дата рождения"
            value={form.birthDate}
            readOnly={!editing}
            onChange={(birthDate) => setForm((f) => ({ ...f, birthDate }))}
          />
          <SelectField
            label="Пол"
            options={SEX_OPTIONS}
            value={form.sex}
            onChange={(v) =>
              setForm((f) => ({ ...f, sex: v as TFormSex }))
            }
          />
          <Field.Root>
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
                onChange={handleWeightChange(setForm)}
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
                    setForm((f) => ({
                      ...f,
                      weightUnit: e.target.value as TWeightUnit,
                    }))
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
          </Field.Root>
          <Box gridColumn={["auto", "1 / -1"]}>
            <TextField
              label="Порода"
              value={form.breed}
              readOnly={!editing}
              onChange={(e) => setForm((f) => ({ ...f, breed: e.target.value }))}
            />
          </Box>
        </Grid>
        {editing && (
          <FormActions
            onSave={() => setEditing(false)}
            onCancel={() => {
              setForm(buildForm(pet));
              setEditing(false);
            }}
          />
        )}
      </Stack>
    </Card>
  );
}
