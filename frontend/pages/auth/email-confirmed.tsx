import { Box, HStack, Spinner, Text, VStack } from "@chakra-ui/react";
import { useMutation } from "@tanstack/react-query";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useRef } from "react";
import { LuArrowRight, LuCircleCheck } from "react-icons/lu";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Card } from "@/components/ui/Card";
import { PrimaryButton } from "@/components/ui/Buttons";
import { ApiError } from "@/lib/api";
import { confirmEmail } from "@/lib/authApi";
import { persistAuthSession } from "@/lib/session";

const errorMessage = (error: unknown): string => {
  if (error instanceof ApiError && error.code === "INVALID_CONFIRMATION_TOKEN") {
    return "Ссылка подтверждения недействительна или уже использована.";
  }

  if (error instanceof ApiError) return error.message;
  return "Не удалось подтвердить email. Попробуйте войти или запросить новую ссылку.";
};

export default function EmailConfirmedPage() {
  const router = useRouter();
  const submittedToken = useRef<string | null>(null);

  const confirmMutation = useMutation({
    mutationFn: (token: string) => confirmEmail(token),
    onSuccess: (response) => {
      persistAuthSession({
        user: response.user,
      });
      router.replace("/auth/email-confirmed", undefined, { shallow: true });
    },
  });
  const confirm = confirmMutation.mutate;

  useEffect(() => {
    if (!router.isReady) return;

    const token = typeof router.query.token === "string" ? router.query.token : "";
    if (!token || submittedToken.current === token) return;

    submittedToken.current = token;
    confirm(token);
  }, [confirm, router.isReady, router.query.token]);

  const hasToken = typeof router.query.token === "string" && router.query.token.length > 0;
  const isSuccess = confirmMutation.isSuccess && Boolean(confirmMutation.data);
  const isLoading = !router.isReady || (hasToken && !confirmMutation.isError && !isSuccess);
  const successTarget = confirmMutation.data?.nextStep === "onboarding" ? "/auth?step=pet" : "/pets";
  const successButtonText =
    confirmMutation.data?.nextStep === "onboarding"
      ? "Перейти к онбордингу"
      : "Перейти к питомцам";

  return (
    <>
      <Head>
        <title>Подтверждение email — Pawsport</title>
      </Head>
      <AuthLayout>
        <VStack gap="32px">
          <Card w="full" maxW="460px" p={["20px", null, "24px"]}>
            <VStack gap="20px" align="stretch">
              {isLoading ? (
                <>
                  <HStack gap="12px">
                    <Spinner color="primary.400" />
                    <Text fontSize="22px" fontWeight={700}>
                      Подтверждаем email
                    </Text>
                  </HStack>
                  <Text color="fg.muted">
                    Это займет несколько секунд.
                  </Text>
                </>
              ) : isSuccess ? (
                <>
                  <HStack gap="12px">
                    <Box color="status.success" fontSize="24px">
                      <LuCircleCheck />
                    </Box>
                    <Text fontSize="22px" fontWeight={700}>
                      Email подтвержден
                    </Text>
                  </HStack>
                  <Text color="fg.muted">
                    Теперь можно продолжить настройку Pawsport.
                  </Text>
                  <PrimaryButton onClick={() => router.push(successTarget)}>
                    <HStack gap="8px">
                      <Text>{successButtonText}</Text>
                      <LuArrowRight />
                    </HStack>
                  </PrimaryButton>
                </>
              ) : (
                <>
                  <Text fontSize="22px" fontWeight={700}>
                    Не удалось подтвердить email
                  </Text>
                  <Box
                    bg="red.950"
                    borderWidth="1px"
                    borderColor="red.700"
                    color="red.100"
                    rounded="field"
                    px="14px"
                    py="10px"
                  >
                    <Text fontSize="13px">
                      {hasToken
                        ? errorMessage(confirmMutation.error)
                        : "В ссылке нет токена подтверждения."}
                    </Text>
                  </Box>
                  <PrimaryButton onClick={() => router.push("/auth/login")}>
                    <HStack gap="8px">
                      <Text>Перейти ко входу</Text>
                      <LuArrowRight />
                    </HStack>
                  </PrimaryButton>
                </>
              )}
            </VStack>
          </Card>
        </VStack>
      </AuthLayout>
    </>
  );
}
