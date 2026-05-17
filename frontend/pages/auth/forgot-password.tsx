import { Box, HStack, Stack, Text, VStack } from "@chakra-ui/react";
import { useMutation } from "@tanstack/react-query";
import Head from "next/head";
import { useRouter } from "next/router";
import { useState, type FormEvent } from "react";
import { LuArrowLeft, LuArrowRight, LuCircleCheck, LuMail } from "react-icons/lu";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { PrimaryButton, SecondaryButton } from "@/components/ui/Buttons";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { ApiError } from "@/lib/api";
import { requestPasswordReset } from "@/lib/authApi";

const errorMessage = (error: unknown): string => {
  if (error instanceof ApiError && error.code === "INVALID_EMAIL") {
    return "Введите корректный email.";
  }

  if (error instanceof ApiError) return error.message;
  return "Не удалось отправить ссылку. Попробуйте еще раз.";
};

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  const resetMutation = useMutation({
    mutationFn: () => requestPasswordReset({ email: email.trim() }),
  });

  const fieldError = resetMutation.isError ? errorMessage(resetMutation.error) : undefined;
  const canSubmit = Boolean(email.trim() && !resetMutation.isPending);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (canSubmit) resetMutation.mutate();
  };

  return (
    <>
      <Head>
        <title>Сброс пароля — Pawsport</title>
      </Head>
      <AuthLayout showHeader onBack={() => router.push("/auth/login")}>
        <VStack gap="32px">
          <Card w="full" maxW="460px" p={["20px", null, "24px"]}>
            {resetMutation.isSuccess ? (
              <VStack gap="20px" align="stretch">
                <HStack gap="12px">
                  <Box color="status.success" fontSize="24px">
                    <LuCircleCheck />
                  </Box>
                  <Text fontSize="22px" fontWeight={700}>
                    Проверьте почту
                  </Text>
                </HStack>
                <Text color="fg.muted">
                  Если аккаунт с таким email существует, мы отправили ссылку для сброса пароля.
                </Text>
                <PrimaryButton onClick={() => router.push("/auth/login")}>
                  <HStack gap="8px">
                    <Text>Вернуться ко входу</Text>
                    <LuArrowRight />
                  </HStack>
                </PrimaryButton>
              </VStack>
            ) : (
              <VStack as="form" gap="20px" align="stretch" onSubmit={handleSubmit}>
                <Stack gap="8px">
                  <Text fontSize="24px" fontWeight={700}>
                    Сброс пароля
                  </Text>
                  <Text color="fg.muted">
                    Введите email, и мы отправим ссылку для создания нового пароля.
                  </Text>
                </Stack>

                <TextField
                  label="Email"
                  type="email"
                  placeholder="name@example.com"
                  startElement={<LuMail />}
                  value={email}
                  errorText={fieldError}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (resetMutation.isError) resetMutation.reset();
                  }}
                />

                <PrimaryButton
                  type="submit"
                  disabled={!canSubmit}
                  loading={resetMutation.isPending}
                >
                  <HStack gap="8px">
                    <Text>Отправить ссылку</Text>
                    <LuArrowRight />
                  </HStack>
                </PrimaryButton>
                <SecondaryButton onClick={() => router.push("/auth/login")}>
                  <HStack gap="8px">
                    <LuArrowLeft />
                    <Text>Назад ко входу</Text>
                  </HStack>
                </SecondaryButton>
              </VStack>
            )}
          </Card>
        </VStack>
      </AuthLayout>
    </>
  );
}
