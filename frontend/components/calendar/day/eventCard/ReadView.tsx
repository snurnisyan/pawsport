import { HStack, Stack, Text } from "@chakra-ui/react";
import {
  LuBell,
  LuCalendar,
  LuClock,
  LuFile,
  LuFileText,
  LuMapPin,
  LuPawPrint,
  LuPenLine,
  LuTag,
  LuTrash,
} from "react-icons/lu";
import { GhostButton, SecondaryButton } from "@/components/ui/Buttons";
import {
  REMINDER_OPTIONS,
  TYPE_OPTIONS,
} from "@/components/pets/events/EventForm";
import { EVENT_SUBTYPE_LABEL } from "@/lib/eventTypes";
import { FieldRow } from "./FieldRow";
import { FilesList } from "./FilesList";
import type { TDayEvent } from "./types";

const lookupLabel = (options: { value: string; label: string }[], v?: string) =>
  options.find((o) => o.value === v)?.label;

type TReadViewProps = {
  event: TDayEvent;
  onEdit: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
};

export function ReadView({ event, onEdit, onDelete, isDeleting }: TReadViewProps) {
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
      <HStack gap="12px">
        {onDelete && (
          <GhostButton
            flex={1}
            h="40px"
            onClick={onDelete}
            disabled={isDeleting}
            color="red.300"
            _hover={{ bg: "rgba(248, 113, 113, 0.12)", color: "red.200" }}
          >
            <HStack gap="8px">
              <LuTrash />
              <Text fontSize="14px">Удалить</Text>
            </HStack>
          </GhostButton>
        )}
        <SecondaryButton flex={1} h="40px" onClick={onEdit} disabled={isDeleting}>
          <HStack gap="8px">
            <LuPenLine />
            <Text fontSize="14px">Редактировать</Text>
          </HStack>
        </SecondaryButton>
      </HStack>
    </Stack>
  );
}
