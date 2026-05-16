import { useMemo } from "react";
import { Stack } from "@chakra-ui/react";
import type { TPetEvent } from "@/store/pets";
import { EventGroupBlock } from "./EventGroupBlock";
import { EventsPastPreview } from "./EventsPastPreview";
import { buildGroups } from "./eventsShared";

type TEventsFeedProps = {
  events: TPetEvent[];
  onEdit: (event: TPetEvent) => void;
};

export function EventsFeed({ events, onEdit }: TEventsFeedProps) {
  const groups = useMemo(() => buildGroups(events), [events]);

  const currentIdx = groups.findIndex((g) => g.isCurrent);
  const pastGroups = currentIdx > 0 ? groups.slice(0, currentIdx) : [];
  const currentGroup = currentIdx >= 0 ? groups[currentIdx] : null;
  const futureGroups = currentIdx >= 0 ? groups.slice(currentIdx + 1) : [];

  return (
    <Stack gap="24px">
      {pastGroups.length > 0 && (
        <EventsPastPreview groups={pastGroups} onEdit={onEdit} />
      )}
      {currentGroup && (
        <EventGroupBlock group={currentGroup} onEdit={onEdit} highlighted />
      )}
      {futureGroups.map((g) => (
        <EventGroupBlock key={g.key} group={g} onEdit={onEdit} />
      ))}
    </Stack>
  );
}
