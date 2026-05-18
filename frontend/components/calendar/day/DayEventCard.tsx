import { useEffect, useState, type ReactNode } from "react";
import { Box, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import {
  LuBell,
  LuCalendar,
  LuChevronDown,
  LuClock,
  LuFile,
  LuFileText,
  LuMapPin,
  LuPawPrint,
  LuPenLine,
  LuTag,
} from "react-icons/lu";
import { Pressable } from "@/components/ui/Pressable";
import { GhostButton, PrimaryButton, SecondaryButton } from "@/components/ui/Buttons";
import {
  EventForm,
  INITIAL_EVENT,
  REMINDER_OPTIONS,
  TYPE_OPTIONS,
  type TEventFormData,
  type TExistingEventFile,
  type TPetOption,
  type TReminderValue,
} from "@/components/pets/events/EventForm";
import { fromEvent } from "@/components/pets/events/eventFormMapping";
import {
  EVENT_SUBTYPE_LABEL,
  EVENT_TYPE_META,
  isEventSubtypeSupported,
} from "@/lib/eventTypes";
import type { TPetEvent } from "@/lib/eventsApi";
import type { TPetEventSubtype, TPetEventType } from "@/store/pets";

export type TDayEventType = TPetEventType;

export type TDayEvent = {
  id: string;
  type: TDayEventType;
  subtype?: TPetEventSubtype;
  time: string;
  title: string;
  petId: string;
  petName: string;
  petDescription?: string;
  place?: string;
  comment?: string;
  nextDate?: string;
  reminder?: TReminderValue;
  files?: TExistingEventFile[];
  source: TPetEvent;
};

const lookupLabel = (options: { value: string; label: string }[], v?: string) =>
  options.find((o) => o.value === v)?.label;

type TFieldRowProps = {
  icon: ReactNode;
  label: string;
  children: ReactNode;
};

function FieldRow({ icon, label, children }: TFieldRowProps) {
  return (
    <HStack gap="12px" align="flex-start">
      <Icon color="fg.muted" mt="2px">
        {icon}
      </Icon>
      <Stack gap="4px" flex={1} minW={0}>
        <Text
          fontSize="11px"
          fontWeight={700}
          color="fg.muted"
          textTransform="uppercase"
          letterSpacing="0.08em"
        >
          {label}
        </Text>
        {typeof children === "string" ? (
          <Text fontSize="14px" color="fg.default">
            {children}
          </Text>
        ) : (
          children
        )}
      </Stack>
    </HStack>
  );
}

type TFilesListProps = {
  files: TExistingEventFile[];
};

function FilesList({ files }: TFilesListProps) {
  return (
    <Stack gap="6px">
      {files.map((f, i) => (
        <HStack
          key={`${f.fileId}-${i}`}
          gap="8px"
          bg="secondary.700"
          rounded="md"
          px="10px"
          py="6px"
        >
          <Icon color="primary.400" boxSize="14px">
            <LuFile />
          </Icon>
          <Text fontSize="13px" truncate>
            {f.originalName}
          </Text>
        </HStack>
      ))}
    </Stack>
  );
}

type TReadViewProps = {
  event: TDayEvent;
  onEdit: () => void;
};

function ReadView({ event, onEdit }: TReadViewProps) {
  return (
    <Stack gap="14px" px="16px" pb="16px" pt="4px">
      <FieldRow icon={<LuCalendar />} label="Название">
        {event.title}
      </FieldRow>
      <FieldRow icon={<LuTag />} label="Тип">
        {[
          lookupLabel(TYPE_OPTIONS, event.type) ?? event.type,
          event.subtype ? EVENT_SUBTYPE_LABEL[event.subtype] : undefined,
        ]
          .filter(Boolean)
          .join(" · ")}
      </FieldRow>
      {event.petDescription && (
        <FieldRow icon={<LuPawPrint />} label="Питомец">
          {event.petDescription}
        </FieldRow>
      )}
      {event.nextDate && (
        <FieldRow icon={<LuClock />} label="Следующая дата">
          {event.nextDate}
        </FieldRow>
      )}
      {event.reminder && (
        <FieldRow icon={<LuBell />} label="Напоминание">
          {lookupLabel(REMINDER_OPTIONS, event.reminder) ?? event.reminder}
        </FieldRow>
      )}
      {event.place && (
        <FieldRow icon={<LuMapPin />} label="Место">
          {event.place}
        </FieldRow>
      )}
      {event.comment && (
        <FieldRow icon={<LuFileText />} label="Заметки">
          {event.comment}
        </FieldRow>
      )}
      {event.files && event.files.length > 0 && (
        <FieldRow icon={<LuFile />} label="Файлы">
          <FilesList files={event.files} />
        </FieldRow>
      )}
      <SecondaryButton h="40px" onClick={onEdit}>
        <HStack gap="8px">
          <LuPenLine />
          <Text fontSize="14px">Редактировать</Text>
        </HStack>
      </SecondaryButton>
    </Stack>
  );
}

type TEditViewProps = {
  data: TEventFormData;
  onChange: (patch: Partial<TEventFormData>) => void;
  onCancel: () => void;
  onSave: () => void;
  pets: TPetOption[];
  saveLabel: string;
  existingFiles?: TExistingEventFile[];
  onRemoveExistingFile?: (fileId: string) => void;
  isPending?: boolean;
};

function EditView({
  data,
  onChange,
  onCancel,
  onSave,
  pets,
  saveLabel,
  existingFiles,
  onRemoveExistingFile,
  isPending,
}: TEditViewProps) {
  const subtypeMissing = isEventSubtypeSupported(data.type) && !data.subtype;
  const disabled =
    Boolean(isPending) || !data.title.trim() || !data.type || !data.petId || subtypeMissing;
  return (
    <Stack gap="20px" px="16px" pb="16px" pt="8px">
      <EventForm
        data={data}
        onChange={onChange}
        pets={pets.length > 0 ? pets : undefined}
        existingFiles={existingFiles}
        onRemoveExistingFile={onRemoveExistingFile}
      />
      <HStack gap="12px" pt="4px">
        <GhostButton flex={1} onClick={onCancel} disabled={isPending}>
          Отменить
        </GhostButton>
        <PrimaryButton flex={1} onClick={onSave} disabled={disabled}>
          {saveLabel}
        </PrimaryButton>
      </HStack>
    </Stack>
  );
}

type TDayEventCardProps = {
  event?: TDayEvent;
  pets: TPetOption[];
  expanded: boolean;
  initialData?: Partial<TEventFormData>;
  isPending?: boolean;
  onToggle?: () => void;
  onSave: (data: TEventFormData, keptExistingFileIds: string[]) => boolean | Promise<boolean>;
  onCancel?: () => void;
};

export function DayEventCard({ event,
                                pets,
                                expanded,
                                initialData,
                                isPending = false,
                                onToggle,
                                onSave,
                                onCancel }: TDayEventCardProps) {
  const isCreate = !event;
  const [editMode, setEditMode] = useState(isCreate);
  const [form, setForm] = useState<TEventFormData>(() =>
    event ? fromEvent(event.source) : { ...INITIAL_EVENT, ...(initialData ?? {}) },
  );
  const [keptExistingFiles, setKeptExistingFiles] = useState<TExistingEventFile[]>(
    event?.files ?? []
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (event) {
        setForm(fromEvent(event.source));
        setKeptExistingFiles(event.files ?? []);
        return;
      }

      setForm({ ...INITIAL_EVENT, ...(initialData ?? {}) });
      setKeptExistingFiles([]);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [event, initialData]);

  const meta = event ? EVENT_TYPE_META[event.type] : EVENT_TYPE_META.visit;
  const EventIcon = meta.Icon;
  const headerTime = event?.time ?? "Новое";
  const headerTitle = event ? `${event.title} — ${event.petName}` : "Новое событие";

  const startEdit = () => {
    if (event) {
      setForm(fromEvent(event.source));
      setKeptExistingFiles(event.files ?? []);
    }
    setEditMode(true);
  };

  const cancelEdit = () => {
    if (isCreate) {
      onCancel?.();
      return;
    }
    if (event) {
      setForm(fromEvent(event.source));
      setKeptExistingFiles(event.files ?? []);
    }
    setEditMode(false);
  };

  const handleSave = async () => {
    const saved = await onSave(
      form,
      keptExistingFiles.map((file) => file.fileId)
    );
    if (!saved) return;
    if (!isCreate) setEditMode(false);
  };

  return (
    <Box
      bg="bg.field"
      borderWidth="1px"
      borderColor={expanded ? "border.default" : "border.subtle"}
      rounded="card"
      overflow="hidden"
      transition="border-color 0.15s"
    >
      {isCreate ? (
        <HStack
          gap="12px"
          px="16px"
          py="14px"
          borderBottomWidth="1px"
          borderColor="border.subtle"
        >
          <Box
            w="40px"
            h="40px"
            rounded="lg"
            bg={meta.bg}
            color={meta.color}
            display="flex"
            alignItems="center"
            justifyContent="center"
            flexShrink={0}
          >
            <Icon><LuPenLine /></Icon>
          </Box>
          <Text fontWeight={600}>{headerTitle}</Text>
        </HStack>
      ) : (
        <Pressable
          type="button"
          onClick={onToggle}
          w="full"
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          gap="12px"
          px="16px"
          py="14px"
          bg="transparent"
          cursor="pointer"
          _hover={{ bg: "secondary.700" }}
        >
          <HStack gap="12px" minW={0}>
            <Box
              w="40px"
              h="40px"
              rounded="lg"
              bg={meta.bg}
              color={meta.color}
              display="flex"
              alignItems="center"
              justifyContent="center"
              flexShrink={0}
            >
              <Icon><EventIcon /></Icon>
            </Box>
            <Stack gap="2px" align="flex-start" minW={0}>
              <Text fontSize="12px" fontWeight={700} color={meta.color}>
                {headerTime}
              </Text>
              <Text fontWeight={600} truncate>
                {headerTitle}
              </Text>
            </Stack>
          </HStack>
          <Icon
            color="fg.muted"
            transform={expanded ? "rotate(180deg)" : "rotate(0deg)"}
            transition="transform 0.2s"
          >
            <LuChevronDown />
          </Icon>
        </Pressable>
      )}

      <Box
        display="grid"
        gridTemplateRows={expanded || isCreate ? "1fr" : "0fr"}
        transition="grid-template-rows 0.25s ease"
      >
        <Box overflow="hidden">
          {editMode || isCreate ? (
            <EditView
              data={form}
              onChange={(patch) => setForm((d) => ({ ...d, ...patch }))}
              onCancel={cancelEdit}
              onSave={handleSave}
              pets={isCreate ? pets : []}
              saveLabel={isCreate ? "Добавить" : "Сохранить"}
              existingFiles={isCreate ? [] : keptExistingFiles}
              onRemoveExistingFile={
                isCreate
                  ? undefined
                  : (fileId) =>
                      setKeptExistingFiles((prev) =>
                        prev.filter((file) => file.fileId !== fileId)
                      )
              }
              isPending={isPending}
            />
          ) : event ? (
            <ReadView event={event} onEdit={startEdit} />
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}
