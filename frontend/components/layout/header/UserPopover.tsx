import { Box, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { LuChevronDown, LuLogOut } from "react-icons/lu";
import { PrimaryButton } from "@/components/ui/Buttons";
import { Pressable } from "@/components/ui/Pressable";
import { toaster } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api";
import { resendEmailConfirmation } from "@/lib/authApi";
import { clearAuthSession, useAuthSession } from "@/lib/session";
import { POPOVER_CONTENT_PROPS } from "./popoverStyles";

export function useResendEmail() {
  const mutation = useMutation({
    mutationFn: resendEmailConfirmation,
    onSuccess: () => {
      toaster.create({
        type: "success",
        title: "Письмо отправлено",
        description: "Проверьте почту, чтобы подтвердить email.",
      });
    },
    onError: (error) => {
      toaster.error({
        title: "Не удалось отправить письмо",
        description:
          error instanceof ApiError
            ? error.message
            : "Попробуйте еще раз позже.",
      });
    },
  });
  return {
    resend: () => mutation.mutate(),
    isPending: mutation.isPending,
  };
}

export function useLogout() {
  const router = useRouter();
  return () => {
    clearAuthSession();
    router.push("/auth/login");
  };
}

type TEmailNotVerifiedBlockProps = {
  onResend: () => void;
  isPending: boolean;
};

export function EmailNotVerifiedBlock({ onResend, isPending }: TEmailNotVerifiedBlockProps) {
  return (
    <Stack gap="8px" px="4px" py="4px">
      <Text fontSize="13px" color="fg.muted" textAlign="center">
        Ваш email не подтвержден
      </Text>
      <PrimaryButton h="36px" onClick={onResend} loading={isPending}>
        Подтвердить
      </PrimaryButton>
    </Stack>
  );
}

type TLogoutRowProps = {
  onClick: () => void;
};

export function LogoutRow({ onClick }: TLogoutRowProps) {
  return (
    <Pressable
      type="button"
      onClick={onClick}
      display="flex"
      alignItems="center"
      gap="10px"
      w="full"
      px="12px"
      py="10px"
      rounded="md"
      color="fg.default"
      cursor="pointer"
      _hover={{ bg: "secondary.700" }}
    >
      <Box color="fg.muted" fontSize="16px">
        <LuLogOut />
      </Box>
      <Text fontSize="14px">Выйти</Text>
    </Pressable>
  );
}

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
