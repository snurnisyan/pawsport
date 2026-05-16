import { useState } from "react";
import { HStack, Stack, Text } from "@chakra-ui/react";
import { LuMail, LuPhone, LuStethoscope } from "react-icons/lu";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import type { TPet } from "@/store/pets";
import { FormActions } from "./FormActions";
import { SectionCardHeader } from "./SectionCardHeader";

type TVetSectionProps = { vet: NonNullable<TPet["vet"]> };

export function VetSection({ vet }: TVetSectionProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(vet);

  return (
    <Card>
      <SectionCardHeader
        icon={<LuStethoscope />}
        title="Ветеринар"
        editing={editing}
        onEditClick={() => setEditing(true)}
      />
      <Stack gap="12px">
        <TextField
          value={form.name}
          readOnly={!editing}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        {editing ? (
          <>
            <TextField
              value={form.phone}
              startElement={<LuPhone />}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <TextField
              value={form.email}
              startElement={<LuMail />}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <FormActions
              onSave={() => setEditing(false)}
              onCancel={() => {
                setForm(vet);
                setEditing(false);
              }}
            />
          </>
        ) : (
          <>
            <HStack color="fg.muted" fontSize="14px" gap="8px">
              <LuPhone />
              <Text>{form.phone}</Text>
            </HStack>
            <HStack color="fg.muted" fontSize="14px" gap="8px">
              <LuMail />
              <Text>{form.email}</Text>
            </HStack>
          </>
        )}
      </Stack>
    </Card>
  );
}
