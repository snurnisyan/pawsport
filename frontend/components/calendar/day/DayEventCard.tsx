import { useEffect, useState } from "react";
import { Box, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { LuChevronDown, LuPenLine } from "react-icons/lu";
import { Pressable } from "@/components/ui/Pressable";
import {
  INITIAL_EVENT,
  type TEventFormData,
  type TExistingEventFile,
  type TPetOption,
} from "@/components/pets/events/EventForm";
import { fromEvent } from "@/components/pets/events/eventTransforms";
import { EVENT_TYPE_META } from "@/lib/eventTypes";
import { EditView } from "./eventCard/EditView";
import { ReadView } from "./eventCard/ReadView";
import type { TDayEvent } from "./eventCard/types";

export type { TDayEvent, TDayEventType } from "./eventCard/types";

type TDayEventCardProps = {
  event?: TDayEvent;
  pets: TPetOption[];
  expanded: boolean;
  initialData?: Partial<TEventFormData>;
  isPending?: boolean;
  isDeleting?: boolean;
  onToggle?: () => void;
  onSave: (data: TEventFormData, keptExistingFileIds: string[]) => boolean | Promise<boolean>;
  onCancel?: () => void;
  onDelete?: (event: TDayEvent) => void;
};

export function DayEventCard({
  event,
  pets,
  expanded,
  initialData,
  isPending = false,
  isDeleting = false,
  onToggle,
  onSave,
  onCancel,
  onDelete,
}: TDayEventCardProps) {
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
            <ReadView
              event={event}
              onEdit={startEdit}
              onDelete={onDelete ? () => onDelete(event) : undefined}
              isDeleting={isDeleting}
            />
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}
