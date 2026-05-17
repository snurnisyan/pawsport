import { Field, Grid, Stack, Textarea } from "@chakra-ui/react";
import { DateInput } from "@/components/ui/DateInput";
import { FileDropZone } from "@/components/ui/FileDropZone";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { TimeInput } from "@/components/ui/TimeInput";
import {
  EVENT_TYPE_OPTIONS,
  getEventSubtypeOptions,
  isEventSubtypeSupported,
  isEventSubtypeValidForType,
} from "@/lib/eventTypes";
import type { TPetEventSubtype, TPetEventType } from "@/store/pets";

export type TReminderValue = "none" | "day" | "week" | "month";

export type TEventFormData = {
  title: string;
  type: TPetEventType | "";
  subtype: TPetEventSubtype | "";
  petId: string;
  date: string;
  time: string;
  nextDate: string;
  reminder: TReminderValue;
  clinic: string;
  comment: string;
  files: File[];
};

export const INITIAL_EVENT: TEventFormData = {
  title: "",
  type: "",
  subtype: "",
  petId: "",
  date: "",
  time: "",
  nextDate: "",
  reminder: "day",
  clinic: "",
  comment: "",
  files: [],
};

export const TYPE_OPTIONS = EVENT_TYPE_OPTIONS satisfies {
  value: TPetEventType;
  label: string;
}[];

export const REMINDER_OPTIONS: { value: TReminderValue; label: string }[] = [
  { value: "none", label: "Без напоминания" },
  { value: "day", label: "За 1 день" },
  { value: "week", label: "За неделю" },
  { value: "month", label: "За месяц" },
];

export type TPetOption = { value: string; label: string };

type TEventFormProps = {
  data: TEventFormData;
  onChange: (patch: Partial<TEventFormData>) => void;
  pets?: TPetOption[];
};

export function EventForm({ data, onChange, pets }: TEventFormProps) {
  const subtypeOptions = getEventSubtypeOptions(data.type);
  const showSubtype = isEventSubtypeSupported(data.type);

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
        onChange={(v) => {
          const type = v as TPetEventType;
          onChange({
            type,
            subtype: isEventSubtypeValidForType(type, data.subtype) ? data.subtype : "",
          });
        }}
      />

      {showSubtype && (
        <SelectField
          label="Подтип"
          placeholder="Выберите подтип"
          options={subtypeOptions}
          value={data.subtype}
          onChange={(v) => onChange({ subtype: v as TPetEventSubtype })}
        />
      )}

      <Grid templateColumns={["1fr", "1fr 1fr"]} gap="16px">
        <DateInput
          label="Дата"
          value={data.date}
          onChange={(date) => onChange({ date })}
        />
        <TimeInput
          label="Время"
          value={data.time}
          onChange={(time) => onChange({ time })}
        />
      </Grid>

      <DateInput
        label="Следующая дата"
        value={data.nextDate}
        onChange={(nextDate) => onChange({ nextDate })}
      />

      <SelectField
        label="Напомнить"
        options={REMINDER_OPTIONS}
        value={data.reminder}
        onChange={(v) => onChange({ reminder: v as TReminderValue })}
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
