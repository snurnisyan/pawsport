import { Stack, Text } from "@chakra-ui/react";
import type { TPetEvent } from "@/lib/petsApi";
import { EventRow } from "./EventRow";
import type { TEventGroup } from "./eventsShared";

type TEventGroupBlockProps = {
  group: TEventGroup;
  onEdit: (event: TPetEvent) => void;
  onDelete: (event: TPetEvent) => void;
  highlighted?: boolean;
};

export function EventGroupBlock({
  group,
  onEdit,
  onDelete,
  highlighted,
}: TEventGroupBlockProps) {
  return (
    <Stack gap="12px">
      <Text
        fontSize="12px"
        fontWeight={700}
        letterSpacing="0.12em"
        textTransform="uppercase"
        color={highlighted ? "fg.accent" : "fg.muted"}
      >
        {group.label}
      </Text>
      {group.events.length === 0 ? (
        <Text fontSize="13px" color="fg.muted">
          Нет событий
        </Text>
      ) : (
        <Stack gap="8px">
          {group.events.map((e) => (
            <EventRow key={e.id} event={e} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
