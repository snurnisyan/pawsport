import { useMutation } from "@tanstack/react-query";
import { toaster } from "@/components/ui/toaster";
import { resendEmailConfirmation } from "@/lib/authApi";
import { apiErrorMessage } from "@/utils/apiErrorMessage";

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
        description: apiErrorMessage(error, "Попробуйте еще раз позже."),
      });
    },
  });
  return {
    resend: () => mutation.mutate(),
    isPending: mutation.isPending,
  };
}
