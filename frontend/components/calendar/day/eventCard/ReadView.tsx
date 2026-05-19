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
} from "react-icons/lu";
import { SecondaryButton } from "@/components/ui/Buttons";
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
};

export function ReadView({ event, onEdit }: TReadViewProps) {
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
