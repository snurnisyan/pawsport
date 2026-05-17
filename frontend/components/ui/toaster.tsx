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

const TOAST_STYLES = {
  error: {
    bg: "red.900",
    borderColor: "red.500",
    indicatorColor: "red.200",
  },
  info: {
    bg: "blue.950",
    borderColor: "blue.500",
    indicatorColor: "blue.200",
  },
  success: {
    bg: "green.950",
    borderColor: "green.500",
    indicatorColor: "green.200",
  },
} as const;

const toastStyle = (type: string | undefined) => {
  if (type === "error" || type === "info" || type === "success") {
    return TOAST_STYLES[type];
  }
  return TOAST_STYLES.info;
};

export function AppToaster() {
  return (
    <Toaster
      toaster={toaster}
      width={{ base: "calc(100vw - 2rem)", sm: "sm" }}
      maxW="calc(100vw - 2rem)"
    >
      {(toast) => {
        const style = toastStyle(toast.type);

        return (
          <ToastRoot
            alignItems="flex-start"
            bg={style.bg}
            borderColor={style.borderColor}
            borderWidth="1px"
            borderRadius="field"
            boxShadow="card"
            color="white"
            gap="12px"
            minH="64px"
            px="16px"
            py="14px"
          >
            <ToastIndicator color={style.indicatorColor} flexShrink={0} mt="2px" />
            <Stack flex={1} gap="2px" minW={0} pe="20px">
              {toast.title && (
                <ToastTitle fontSize="14px" fontWeight="700" lineHeight="1.3">
                  {toast.title}
                </ToastTitle>
              )}
              {toast.description && (
                <ToastDescription color="whiteAlpha.800" fontSize="13px" lineHeight="1.35">
                  {toast.description}
                </ToastDescription>
              )}
            </Stack>
            <ToastCloseTrigger color="whiteAlpha.800" insetEnd="10px" top="10px" />
          </ToastRoot>
        );
      }}
    </Toaster>
  );
}
