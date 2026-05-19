import { useState } from "react";
import { Box, IconButton, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import { LuMenu } from "react-icons/lu";
import { useAuthSession } from "@/lib/session";
import { useLogout } from "./hooks/useLogout";
import { useOpenReminderPet } from "./hooks/useOpenReminderPet";
import { useReminders } from "./hooks/useReminders";
import { useResendEmail } from "./hooks/useResendEmail";
import { POPOVER_CONTENT_PROPS } from "./popoverStyles";
import { RemindersContent } from "./reminders/RemindersContent";
import { EmailNotVerifiedBlock } from "./user/EmailNotVerifiedBlock";
import { LogoutRow } from "./user/LogoutRow";

export function MobileMenuPopover() {
  const [open, setOpen] = useState(false);
  const session = useAuthSession();
  const emailVerified = session?.user.emailVerified ?? true;
  const { authenticated, reminders, isLoading, error, hasUnreadReminders } =
    useReminders(open);
  const onOpenPet = useOpenReminderPet(() => setOpen(false));
  const { resend, isPending } = useResendEmail();
  const logout = useLogout();

  return (
    <Popover.Root
      positioning={{ placement: "bottom-end" }}
      open={open}
      onOpenChange={(details) => setOpen(details.open)}
    >
      <Popover.Trigger asChild>
        <IconButton
          aria-label="Меню"
          variant="ghost"
          size="sm"
          color="fg.muted"
          display={["inline-flex", null, "none"]}
        >
          <LuMenu />
        </IconButton>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content {...POPOVER_CONTENT_PROPS} minW="240px">
            <Stack gap="4px">
              <Text
                fontSize="11px"
                fontWeight={700}
                color="fg.muted"
                textTransform="uppercase"
                letterSpacing="0.08em"
                px="12px"
                pt="4px"
              >
                Напоминания
                {hasUnreadReminders && (
                  <Box
                    as="span"
                    aria-hidden="true"
                    display="inline-block"
                    boxSize="7px"
                    rounded="full"
                    bg="red.500"
                    ms="8px"
                    verticalAlign="middle"
                  />
                )}
              </Text>
              <RemindersContent
                authenticated={authenticated}
                reminders={reminders}
                isLoading={isLoading}
                error={error}
                onOpenPet={onOpenPet}
                showTitle={false}
              />
              <Box h="1px" bg="border.subtle" my="4px" />
              {!emailVerified && (
                <>
                  <EmailNotVerifiedBlock onResend={resend} isPending={isPending} />
                  <Box h="1px" bg="border.subtle" my="4px" />
                </>
              )}
              <LogoutRow onClick={logout} />
            </Stack>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
