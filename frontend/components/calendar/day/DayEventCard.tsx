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
  type TPetOption,
} from "@/components/pets/events/EventForm";
import type { TPetEventType } from "@/store/pets";

export type TDayEventType = TPetEventType;

export type TDayEvent = {
  id: string;
  type: TDayEventType;
  time: string;
  title: string;
  petId: string;
  petName: string;
  petDescription?: string;
  place?: string;
  comment?: string;
  nextDate?: string;
  reminder?: string;
  files?: { name: string }[];
};

const TYPE_META: Record<TDayEventType, { icon: ReactNode; bg: string; color: string }> = {
  vaccine: { icon: <LuPawPrint />, bg: "rgba(168, 85, 247, 0.18)", color: "#D8B4FE" },
  treatment: { icon: <LuFileText />, bg: "rgba(20, 184, 166, 0.18)", color: "#5EEAD4" },
  visit: { icon: <LuPawPrint />, bg: "rgba(59, 130, 246, 0.18)", color: "#93C5FD" },
  operation: { icon: <LuPenLine />, bg: "rgba(245, 158, 11, 0.18)", color: "#FCD34D" },
};

const lookupLabel = (options: { value: string; label: string }[], v?: string) =>
  options.find((o) => o.value === v)?.label;

const eventToForm = (event: TDayEvent): TEventFormData => ({
  title: event.title,
  type: event.type,
  petId: event.petId,
  date: "",
  time: event.time ?? "",
  nextDate: event.nextDate ?? "",
  reminder: event.reminder ?? "1d",
  clinic: event.place ?? "",
  comment: event.comment ?? "",
  files: [],
});

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
  files: { name: string }[];
};

function FilesList({ files }: TFilesListProps) {
  return (
    <Stack gap="6px">
      {files.map((f, i) => (
        <HStack
          key={`${f.name}-${i}`}
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
            {f.name}
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
        {lookupLabel(TYPE_OPTIONS, event.type) ?? event.type}
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
};

function EditView({ data, onChange, onCancel, onSave, pets, saveLabel }: TEditViewProps) {
  const disabled = !data.title.trim() || !data.type || !data.petId;
  return (
    <Stack gap="20px" px="16px" pb="16px" pt="8px">
      <EventForm data={data} onChange={onChange} pets={pets} />
      <HStack gap="12px" pt="4px">
        <GhostButton flex={1} onClick={onCancel}>
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
  onToggle?: () => void;
  onSave: (data: TEventFormData) => void;
  onCancel?: () => void;
};

export function DayEventCard({ event,
                                pets,
                                expanded,
                                onToggle,
                                onSave,
                                onCancel }: TDayEventCardProps) {
  const isCreate = !event;
  const [editMode, setEditMode] = useState(isCreate);
  const [form, setForm] = useState<TEventFormData>(() =>
    event ? eventToForm(event) : INITIAL_EVENT,
  );

  useEffect(() => {
    if (event && !editMode) setForm(eventToForm(event));
  }, [event, editMode]);

  const meta = event ? TYPE_META[event.type] : TYPE_META.visit;
  const headerTime = event?.time ?? "Новое";
  const headerTitle = event ? `${event.title} — ${event.petName}` : "Новое событие";

  const startEdit = () => {
    if (event) setForm(eventToForm(event));
    setEditMode(true);
  };

  const cancelEdit = () => {
    if (isCreate) {
      onCancel?.();
      return;
    }
    if (event) setForm(eventToForm(event));
    setEditMode(false);
  };

  const handleSave = () => {
    onSave(form);
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
              <Icon>{meta.icon}</Icon>
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
              pets={pets}
              saveLabel={isCreate ? "Добавить" : "Сохранить"}
            />
          ) : event ? (
            <ReadView event={event} onEdit={startEdit} />
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}
