import { Box, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import { LuChevronDown } from "react-icons/lu";
import { Pressable } from "@/components/ui/Pressable";
import { useAuthSession } from "@/lib/session";
import { useLogout } from "./hooks/useLogout";
import { useResendEmail } from "./hooks/useResendEmail";
import { POPOVER_CONTENT_PROPS } from "./popoverStyles";
import { EmailNotVerifiedBlock } from "./user/EmailNotVerifiedBlock";
import { LogoutRow } from "./user/LogoutRow";

type TUserPopoverProps = {
  fallbackEmail: string;
};

export function UserPopover({ fallbackEmail }: TUserPopoverProps) {
  const session = useAuthSession();
  const email = session?.user.email ?? fallbackEmail;
  const emailVerified = session?.user.emailVerified ?? true;
  const { resend, isPending } = useResendEmail();
  const logout = useLogout();

  return (
    <Popover.Root positioning={{ placement: "bottom-end" }}>
      <Popover.Trigger asChild>
        <Pressable
          type="button"
          display={["none", "none", "flex"]}
          alignItems="center"
          gap="6px"
          h="32px"
          px="10px"
          rounded="md"
          color="fg.muted"
          cursor="pointer"
          _hover={{ color: "fg.default", bg: "secondary.700" }}
        >
          <Text fontSize="14px">{email}</Text>
          <Box fontSize="14px">
            <LuChevronDown />
          </Box>
        </Pressable>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content {...POPOVER_CONTENT_PROPS} minW="auto" w="280px">
            <Stack gap="4px">
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
