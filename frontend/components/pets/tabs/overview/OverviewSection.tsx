import { useState } from "react";
import { Box, Grid, Stack } from "@chakra-ui/react";
import { LuUser } from "react-icons/lu";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import type { TPet } from "@/store/pets";
import { FormActions } from "./FormActions";
import { SectionCardHeader } from "./SectionCardHeader";

type TOverviewSectionProps = { pet: TPet };

const buildForm = (pet: TPet) => ({
  chipNumber: pet.chipNumber ?? "",
  birthDate: pet.birthDate ?? "",
  sex: pet.sex === "male" ? "Мальчик" : "Девочка",
  weight: `${pet.weightKg} кг`,
  breed: pet.breed,
});

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
          <TextField
            label="Дата рождения"
            value={form.birthDate}
            readOnly={!editing}
            onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
          />
          <TextField
            label="Пол"
            value={form.sex}
            readOnly={!editing}
            onChange={(e) => setForm((f) => ({ ...f, sex: e.target.value }))}
          />
          <TextField
            label="Вес"
            value={form.weight}
            readOnly={!editing}
            onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
          />
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
