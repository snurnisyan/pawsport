import { useLayoutEffect, useMemo, useRef } from "react";
import { Box, Stack } from "@chakra-ui/react";
import type { TPetEvent } from "@/lib/petsApi";
import { EventGroupBlock } from "./EventGroupBlock";
import { buildGroups } from "./eventsShared";

const FADE_HEIGHT = 100;

type TEventsFeedProps = {
  events: TPetEvent[];
  onEdit: (event: TPetEvent) => void;
};

export function EventsFeed({ events, onEdit }: TEventsFeedProps) {
  const groups = useMemo(() => buildGroups(events), [events]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const target = currentRef.current;
    if (!scroller || !target) return;
    scroller.scrollTop = Math.max(0, target.offsetTop - FADE_HEIGHT);
  }, [groups]);

  return (
    <Box position="relative">
      <Box
        position="absolute"
        top={0}
        left={0}
        right={0}
        h={`${FADE_HEIGHT}px`}
        bgImage="linear-gradient(to bottom, #050810 0%, #050810 55%, rgba(5,8,16,0.6) 80%, rgba(5,8,16,0) 100%)"
        pointerEvents="none"
        zIndex={1}
      />
      <Stack
        ref={scrollerRef}
        position="relative"
        gap="24px"
        overflowY="auto"
        maxH={["60vh", null, "calc(100vh - 360px)"]}
        pt={`${FADE_HEIGHT}px`}
        pr="4px"
      >
        {groups.map((g) => (
          <Box key={g.key} ref={g.isCurrent ? currentRef : undefined}>
            <EventGroupBlock group={g} onEdit={onEdit} highlighted={g.isCurrent} />
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
