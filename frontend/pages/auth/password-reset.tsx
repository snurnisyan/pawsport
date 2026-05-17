import { Box, HStack, IconButton, Spinner, Stack, Text, VStack } from "@chakra-ui/react";
import { useMutation } from "@tanstack/react-query";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  LuArrowRight,
  LuCircleCheck,
  LuEye,
  LuEyeOff,
  LuLock,
  LuTriangleAlert,
} from "react-icons/lu";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { PrimaryButton } from "@/components/ui/Buttons";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { ApiError } from "@/lib/api";
import { confirmPasswordReset, validatePasswordResetToken } from "@/lib/authApi";

const TOKEN_ERROR_TEXT = "Ссылка для сброса пароля истекла или уже была использована.";

const passwordErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError && error.code === "INVALID_PASSWORD") {
    return "Пароль должен быть не короче 8 символов.";
  }

  if (error instanceof ApiError) return error.message;
  return "Не удалось обновить пароль. Попробуйте еще раз.";
};

const isInvalidResetTokenError = (error: unknown): boolean =>
  error instanceof ApiError && error.code === "INVALID_RESET_TOKEN";

export default function PasswordResetPage() {
  const router = useRouter();
  const submittedToken = useRef<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [localPasswordError, setLocalPasswordError] = useState<string | null>(null);

  const validateMutation = useMutation({
    mutationFn: (token: string) => validatePasswordResetToken(token),
    onSuccess: () => {
      router.replace("/auth/password-reset", undefined, { shallow: true });
    },
  });
  const validateToken = validateMutation.mutate;

  const confirmMutation = useMutation({
    mutationFn: () => {
      if (!resetToken) throw new Error("Missing reset token");
      return confirmPasswordReset({ token: resetToken, password });
    },
  });

  useEffect(() => {
    if (!router.isReady) return;

    const token = typeof router.query.token === "string" ? router.query.token : "";
    if (!token || submittedToken.current === token) return;

    submittedToken.current = token;
    setResetToken(token);
    validateToken(token);
  }, [router.isReady, router.query.token, validateToken]);

  const hasQueryToken = typeof router.query.token === "string" && router.query.token.length > 0;
  const isValidated = validateMutation.isSuccess && Boolean(resetToken);
  const isLoading =
    !router.isReady || (hasQueryToken && !validateMutation.isError && !isValidated);
  const tokenIsMissing =
    router.isReady && !hasQueryToken && !resetToken && !validateMutation.isSuccess;
  const tokenIsInvalid =
    tokenIsMissing ||
    validateMutation.isError ||
    (confirmMutation.isError && isInvalidResetTokenError(confirmMutation.error));
  const confirmPasswordError =
    confirmMutation.isError && !isInvalidResetTokenError(confirmMutation.error)
      ? passwordErrorMessage(confirmMutation.error)
      : undefined;
  const passwordError = localPasswordError ?? confirmPasswordError;
  const canSubmit = Boolean(isValidated && password && !confirmMutation.isPending);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setLocalPasswordError(null);

    if (!password) {
      setLocalPasswordError("Введите новый пароль.");
      return;
    }

    if (canSubmit) confirmMutation.mutate();
  };

  return (
    <>
      <Head>
        <title>Новый пароль — Pawsport</title>
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
                      Проверяем ссылку
                    </Text>
                  </HStack>
                  <Text color="fg.muted">Это займет несколько секунд.</Text>
                </>
              ) : confirmMutation.isSuccess ? (
                <>
                  <HStack gap="12px">
                    <Box color="status.success" fontSize="24px">
                      <LuCircleCheck />
                    </Box>
                    <Text fontSize="22px" fontWeight={700}>
                      Пароль обновлен
                    </Text>
                  </HStack>
                  <Text color="fg.muted">Теперь можно войти с новым паролем.</Text>
                  <PrimaryButton onClick={() => router.push("/auth/login")}>
                    <HStack gap="8px">
                      <Text>Перейти ко входу</Text>
                      <LuArrowRight />
                    </HStack>
                  </PrimaryButton>
                </>
              ) : tokenIsInvalid ? (
                <>
                  <HStack gap="12px">
                    <Box color="status.warning" fontSize="24px">
                      <LuTriangleAlert />
                    </Box>
                    <Text fontSize="22px" fontWeight={700}>
                      Ссылка недействительна
                    </Text>
                  </HStack>
                  <Text color="fg.muted">{TOKEN_ERROR_TEXT}</Text>
                  <PrimaryButton onClick={() => router.push("/auth/forgot-password")}>
                    <HStack gap="8px">
                      <Text>Запросить новую ссылку</Text>
                      <LuArrowRight />
                    </HStack>
                  </PrimaryButton>
                </>
              ) : (
                <VStack as="form" gap="20px" align="stretch" onSubmit={handleSubmit}>
                  <Stack gap="8px">
                    <Text fontSize="24px" fontWeight={700}>
                      Новый пароль
                    </Text>
                    <Text color="fg.muted">
                      Введите новый пароль для аккаунта Pawsport.
                    </Text>
                  </Stack>

                  <TextField
                    label="Новый пароль"
                    type={showPwd ? "text" : "password"}
                    placeholder="••••••••"
                    startElement={<LuLock />}
                    endElement={
                      <IconButton
                        aria-label={showPwd ? "Скрыть пароль" : "Показать пароль"}
                        size="xs"
                        variant="ghost"
                        color="fg.muted"
                        onClick={() => setShowPwd((value) => !value)}
                      >
                        {showPwd ? <LuEyeOff /> : <LuEye />}
                      </IconButton>
                    }
                    value={password}
                    errorText={passwordError}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setLocalPasswordError(null);
                      if (confirmMutation.isError) confirmMutation.reset();
                    }}
                  />

                  <PrimaryButton
                    type="submit"
                    disabled={!canSubmit}
                    loading={confirmMutation.isPending}
                  >
                    <HStack gap="8px">
                      <Text>Сохранить пароль</Text>
                      <LuArrowRight />
                    </HStack>
                  </PrimaryButton>
                </VStack>
              )}
            </VStack>
          </Card>
        </VStack>
      </AuthLayout>
    </>
  );
}
