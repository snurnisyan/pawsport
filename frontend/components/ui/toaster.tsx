import {
  Stack,
  ToastCloseTrigger,
  ToastDescription,
  ToastIndicator,
  ToastRoot,
  ToastTitle,
  Toaster,
  createToaster,
} from "@chakra-ui/react";

export const toaster = createToaster({
  placement: "top-end",
  duration: 4500,
});

export function AppToaster() {
  return (
    <Toaster
      toaster={toaster}
      width={{ base: "calc(100vw - 2rem)", sm: "sm" }}
      maxW="calc(100vw - 2rem)"
    >
      {(toast) => (
        <ToastRoot
          alignItems="flex-start"
          borderRadius="field"
          boxShadow="card"
          gap="12px"
          minH="64px"
          px="16px"
          py="14px"
        >
          <ToastIndicator flexShrink={0} mt="2px" />
          <Stack flex={1} gap="2px" minW={0} pe="20px">
            {toast.title && (
              <ToastTitle fontSize="14px" fontWeight="700" lineHeight="1.3">
                {toast.title}
              </ToastTitle>
            )}
            {toast.description && (
              <ToastDescription fontSize="13px" lineHeight="1.35">
                {toast.description}
              </ToastDescription>
            )}
          </Stack>
          <ToastCloseTrigger insetEnd="10px" top="10px" />
        </ToastRoot>
      )}
    </Toaster>
  );
}
