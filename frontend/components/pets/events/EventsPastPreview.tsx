import { Box, Stack } from "@chakra-ui/react";
import type { TPetEvent } from "@/store/pets";
import { EventGroupBlock } from "./EventGroupBlock";
import type { TEventGroup } from "./eventsShared";

const PEEK_HEIGHT = 180;
const FADE_HEIGHT = 130;

type TEventsPastPreviewProps = {
  groups: TEventGroup[];
  onEdit: (event: TPetEvent) => void;
};

export function EventsPastPreview({ groups, onEdit }: TEventsPastPreviewProps) {
  return (
    <Box position="relative" h={`${PEEK_HEIGHT}px`} overflow="hidden">
      <Stack position="absolute" left={0} right={0} bottom={0} gap="24px">
        {groups.map((g) => (
          <EventGroupBlock key={g.key} group={g} onEdit={onEdit} />
        ))}
      </Stack>
      <Box
        position="absolute"
        top={0}
        left={0}
        right={0}
        h={`${FADE_HEIGHT}px`}
        bgImage="linear-gradient(to bottom, #050810 0%, #050810 55%, rgba(5,8,16,0.7) 80%, rgba(5,8,16,0) 100%)"
        pointerEvents="none"
      />
    </Box>
  );
}
