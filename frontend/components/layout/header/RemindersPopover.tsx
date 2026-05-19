import { useState } from "react";
import { Box, IconButton, Popover, Portal } from "@chakra-ui/react";
import { LuBell } from "react-icons/lu";
import { useOpenReminderPet } from "./hooks/useOpenReminderPet";
import { useReminders } from "./hooks/useReminders";
import { POPOVER_CONTENT_PROPS } from "./popoverStyles";
import { RemindersContent } from "./reminders/RemindersContent";

export function RemindersPopover() {
  const [open, setOpen] = useState(false);
  const { authenticated, reminders, isLoading, error, hasUnreadReminders } =
    useReminders(open);
  const onOpenPet = useOpenReminderPet(() => setOpen(false));

  return (
    <Popover.Root
      positioning={{ placement: "bottom-end" }}
      open={open}
      onOpenChange={(details) => setOpen(details.open)}
    >
      <Popover.Trigger asChild>
        <IconButton
          display={["none", "none", "flex"]}
          aria-label={
            hasUnreadReminders ? "Уведомления, есть непрочитанные" : "Уведомления"
          }
          variant="ghost"
          size="sm"
          color="fg.muted"
          position="relative"
          _hover={{ color: "fg.default", bg: "secondary.700" }}
        >
          <LuBell />
          {hasUnreadReminders && (
            <Box
              aria-hidden="true"
              position="absolute"
              top="6px"
              right="6px"
              boxSize="8px"
              rounded="full"
              bg="red.500"
              borderWidth="1px"
              borderColor="bg.canvas"
            />
          )}
        </IconButton>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content {...POPOVER_CONTENT_PROPS} w="320px" maxW="calc(100vw - 32px)">
            <RemindersContent
              authenticated={authenticated}
              reminders={reminders}
              isLoading={isLoading}
              error={error}
              onOpenPet={onOpenPet}
            />
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
