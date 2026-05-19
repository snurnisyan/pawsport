import {
  Box,
  Field,
  FileUpload,
  Grid,
  HStack,
  Icon,
  IconButton,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { LuCloudUpload, LuDownload, LuFile, LuX } from "react-icons/lu";
import { DateInput } from "@/components/ui/DateInput";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { TimeInput } from "@/components/ui/TimeInput";
import { toaster } from "@/components/ui/toaster";
import { downloadFile } from "@/lib/petsApi";
import {
  EVENT_TYPE_OPTIONS,
  getEventSubtypeOptions,
  isEventSubtypeSupported,
  isEventSubtypeValidForType,
} from "@/lib/eventTypes";
import type { TPetEventSubtype, TPetEventType } from "@/store/pets";
import { apiErrorMessage } from "@/utils/apiErrorMessage";
import {
  MAX_UPLOAD_LABEL,
  acceptFilesWithSizeGuard,
  formatSize,
  saveBlob,
} from "@/utils/files";

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

export type TExistingEventFile = {
  fileId: string;
  originalName: string;
};

type TEventFormProps = {
  data: TEventFormData;
  onChange: (patch: Partial<TEventFormData>) => void;
  pets?: TPetOption[];
  existingFiles?: TExistingEventFile[];
  onRemoveExistingFile?: (fileId: string) => void;
};

const FILE_ACCEPT = "application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg";

export function EventForm({
  data,
  onChange,
  pets,
  existingFiles = [],
  onRemoveExistingFile,
}: TEventFormProps) {
  const handleDownload = async (id: string, fallbackName: string) => {
    try {
      const { blob, filename } = await downloadFile(id);
      saveBlob(blob, filename ?? fallbackName);
    } catch (error) {
      toaster.error({
        title: "Не удалось скачать файл",
        description: apiErrorMessage(error, "Попробуйте еще раз."),
      });
    }
  };

  const removeFileAt = (index: number) => {
    onChange({ files: data.files.filter((_, i) => i !== index) });
  };

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

      {showSubtype ? (
        <Grid templateColumns={["1fr", "1fr 1fr"]} gap="16px">
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
          <SelectField
            label="Подтип"
            placeholder="Выберите подтип"
            options={subtypeOptions}
            value={data.subtype}
            onChange={(v) => onChange({ subtype: v as TPetEventSubtype })}
          />
        </Grid>
      ) : (
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
        <FileUpload.Root
          w="full"
          accept={FILE_ACCEPT}
          maxFiles={20}
          onFileAccept={({ files }) => {
            const accepted = acceptFilesWithSizeGuard(files);
            if (accepted.length > 0) {
              onChange({ files: [...data.files, ...accepted] });
            }
          }}
        >
          <FileUpload.HiddenInput />
          <Stack gap="8px" w="full">
            {existingFiles.map((file) => (
              <HStack
                key={file.fileId}
                bg="bg.field"
                borderWidth="1px"
                borderColor="border.subtle"
                rounded="field"
                p="12px"
                gap="12px"
                cursor="pointer"
                onClick={() => handleDownload(file.fileId, file.originalName)}
                _hover={{ borderColor: "primary.500" }}
              >
                <Box
                  w="36px"
                  h="36px"
                  rounded="md"
                  bg="secondary.700"
                  color="primary.400"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  flexShrink={0}
                >
                  <Icon><LuFile /></Icon>
                </Box>
                <Stack gap="0" flex={1} minW={0}>
                  <Text fontSize="14px" fontWeight={500} truncate>
                    {file.originalName}
                  </Text>
                  <Text fontSize="12px" color="fg.muted">
                    Прикреплён к событию · Нажмите, чтобы скачать
                  </Text>
                </Stack>
                <Icon color="fg.muted" flexShrink={0}>
                  <LuDownload />
                </Icon>
                {onRemoveExistingFile && (
                  <IconButton
                    aria-label="Убрать файл"
                    size="sm"
                    variant="ghost"
                    color="fg.muted"
                    flexShrink={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveExistingFile(file.fileId);
                    }}
                    _hover={{ color: "fg.default", bg: "secondary.700" }}
                  >
                    <LuX />
                  </IconButton>
                )}
              </HStack>
            ))}

            {data.files.map((file, idx) => (
              <HStack
                key={`${file.name}-${idx}`}
                bg="bg.field"
                borderWidth="1px"
                borderColor="border.subtle"
                rounded="field"
                p="12px"
                gap="12px"
              >
                <Box
                  w="36px"
                  h="36px"
                  rounded="md"
                  bg="secondary.700"
                  color="primary.400"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  flexShrink={0}
                >
                  <Icon><LuFile /></Icon>
                </Box>
                <Stack gap="0" flex={1} minW={0}>
                  <Text fontSize="14px" fontWeight={500} truncate>
                    {file.name}
                  </Text>
                  <Text fontSize="12px" color="fg.muted">
                    {formatSize(file.size)} · Готов к загрузке
                  </Text>
                </Stack>
                <IconButton
                  aria-label="Убрать файл"
                  size="sm"
                  variant="ghost"
                  color="fg.muted"
                  onClick={() => removeFileAt(idx)}
                  _hover={{ color: "fg.default", bg: "secondary.700" }}
                >
                  <LuX />
                </IconButton>
              </HStack>
            ))}

            <FileUpload.Dropzone
              w="full"
              minH="auto"
              py="14px"
              px="16px"
              rounded="card"
              borderWidth="2px"
              borderStyle="dashed"
              borderColor="border.default"
              bg="bg.field"
              color="fg.muted"
              cursor="pointer"
              transition="all 0.15s"
              _hover={{ borderColor: "primary.500", color: "primary.400" }}
            >
              <HStack gap="12px" align="center" justify="center">
                <Icon boxSize="20px" color="primary.400">
                  <LuCloudUpload />
                </Icon>
                <Stack gap="2px" align="flex-start">
                  <Text fontSize="13px" fontWeight={500}>
                    Нажмите, чтобы загрузить, или перетащите файлы
                  </Text>
                  <Text
                    fontSize="11px"
                    textTransform="uppercase"
                    letterSpacing="0.08em"
                  >
                    PDF, PNG, JPG (макс. {MAX_UPLOAD_LABEL})
                  </Text>
                </Stack>
              </HStack>
            </FileUpload.Dropzone>
          </Stack>
        </FileUpload.Root>
      </Field.Root>
    </Stack>
  );
}
