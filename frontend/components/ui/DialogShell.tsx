import type { ReactNode } from "react";
import { Dialog, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { LuX } from "react-icons/lu";

type TDialogShellSize = "sm" | "md" | "lg";

type TDialogShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: TDialogShellSize;
};

const MAX_W: Record<TDialogShellSize, string> = {
  sm: "420px",
  md: "560px",
  lg: "720px",
};

export function DialogShell({ open,
                              onOpenChange,
                              title,
                              subtitle,
                              children,
                              footer,
                              size = "md" }: TDialogShellProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(d) => onOpenChange(d.open)}
      placement="center"
    >
      <Dialog.Backdrop bg="rgba(0,0,0,0.78)" backdropFilter="blur(4px)" />
      <Dialog.Positioner padding="16px">
        <Dialog.Content
          bg="bg.surface"
          borderColor="border.subtle"
          borderWidth="1px"
          rounded="card"
          shadow="card"
          maxW={MAX_W[size]}
          w="full"
          maxH="90vh"
          display="flex"
          flexDirection="column"
        >
          <Dialog.Header
            px="24px"
            pt="24px"
            pb="20px"
            borderBottomWidth="1px"
            borderColor="border.subtle"
          >
            <HStack justify="space-between" align="flex-start" gap="16px" w="full">
              <Stack gap="4px" flex={1} minW={0}>
                <Dialog.Title fontSize="20px" fontWeight={700}>
                  {title}
                </Dialog.Title>
                {subtitle && (
                  <Text
                    fontSize="12px"
                    color="fg.muted"
                    textTransform="uppercase"
                    letterSpacing="0.08em"
                    fontWeight={600}
                  >
                    {subtitle}
                  </Text>
                )}
              </Stack>
              <IconButton
                aria-label="Закрыть"
                size="sm"
                variant="ghost"
                color="fg.muted"
                onClick={() => onOpenChange(false)}
                _hover={{ color: "fg.default", bg: "secondary.700" }}
              >
                <LuX />
              </IconButton>
            </HStack>
          </Dialog.Header>
          <Dialog.Body px="24px" py="20px" overflowY="auto" flex={1}>
            {children}
          </Dialog.Body>
          {footer && (
            <Dialog.Footer
              px="24px"
              pt="16px"
              pb="24px"
              borderTopWidth="1px"
              borderColor="border.subtle"
            >
              {footer}
            </Dialog.Footer>
          )}
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
