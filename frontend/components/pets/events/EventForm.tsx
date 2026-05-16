import { Field, Grid, Stack, Textarea } from "@chakra-ui/react";
import { FileDropZone } from "@/components/ui/FileDropZone";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import type { TPetEventType } from "@/store/pets";

export type TEventFormData = {
  title: string;
  type: TPetEventType | "";
  petId: string;
  date: string;
  time: string;
  nextDate: string;
  reminder: string;
  clinic: string;
  comment: string;
  files: File[];
};

export const INITIAL_EVENT: TEventFormData = {
  title: "",
  type: "",
  petId: "",
  date: "",
  time: "",
  nextDate: "",
  reminder: "1d",
  clinic: "",
  comment: "",
  files: [],
};

export const TYPE_OPTIONS = [
  { value: "vaccine", label: "Вакцинация" },
  { value: "treatment", label: "Обработка" },
  { value: "visit", label: "Визит" },
  { value: "operation", label: "Операция" },
];

export const REMINDER_OPTIONS = [
  { value: "none", label: "Без напоминания" },
  { value: "1h", label: "За 1 час" },
  { value: "1d", label: "За 1 день" },
  { value: "3d", label: "За 3 дня" },
  { value: "1w", label: "За неделю" },
];

export type TPetOption = { value: string; label: string };

type TEventFormProps = {
  data: TEventFormData;
  onChange: (patch: Partial<TEventFormData>) => void;
  pets?: TPetOption[];
};

export function EventForm({ data, onChange, pets }: TEventFormProps) {
  return (
    <Stack gap="20px">
      <TextField
        label="Название события"
        placeholder="Вакцинация (бешенство)"
        value={data.title}
        onChange={(e) => onChange({ title: e.target.value })}
      />

      {pets && (
        <SelectField
          label="Питомец"
          placeholder="Выберите питомца"
          options={pets}
          value={data.petId}
          onChange={(v) => onChange({ petId: v })}
        />
      )}

      <SelectField
        label="Тип события"
        placeholder="Выберите тип"
        options={TYPE_OPTIONS}
        value={data.type}
        onChange={(v) => onChange({ type: v as TPetEventType })}
      />

      <Grid templateColumns={["1fr", "1fr 1fr"]} gap="16px">
        <TextField
          label="Дата"
          type="date"
          value={data.date}
          onChange={(e) => onChange({ date: e.target.value })}
        />
        <TextField
          label="Время"
          type="time"
          value={data.time}
          onChange={(e) => onChange({ time: e.target.value })}
        />
      </Grid>

      <TextField
        label="Следующая дата"
        type="date"
        value={data.nextDate}
        onChange={(e) => onChange({ nextDate: e.target.value })}
      />

      <SelectField
        label="Напомнить"
        options={REMINDER_OPTIONS}
        value={data.reminder}
        onChange={(v) => onChange({ reminder: v })}
      />

      <TextField
        label="Название клиники (необязательно)"
        placeholder="Ветеринарная клиника"
        value={data.clinic}
        onChange={(e) => onChange({ clinic: e.target.value })}
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
          Комментарий (необязательно)
        </Field.Label>
        <Textarea
          placeholder="Добавьте дополнительные примечания, если есть"
          value={data.comment}
          onChange={(e) => onChange({ comment: e.target.value })}
          bg="bg.field"
          borderColor="border.subtle"
          rounded="field"
          color="fg.default"
          minH="100px"
          px="16px"
          py="12px"
          _placeholder={{ color: "fg.muted" }}
          _hover={{ borderColor: "border.default" }}
          _focusVisible={{ borderColor: "primary.500", boxShadow: "glowSoft" }}
        />
      </Field.Root>

      <Field.Root>
        <Field.Label
          fontSize="12px"
          fontWeight={600}
          color="fg.muted"
          textTransform="uppercase"
          letterSpacing="0.08em"
          mb="8px"
        >
          Файлы
        </Field.Label>
        <FileDropZone
          multiple
          accept=".pdf,image/*"
          onFiles={(files) => onChange({ files: [...data.files, ...files] })}
          subtitle="PDF, PNG, JPG (макс. 20MB)"
          height="140px"
        />
      </Field.Root>
    </Stack>
  );
}
