import { Box, HStack, IconButton, Stack, Text, VStack } from "@chakra-ui/react";
import { useMutation } from "@tanstack/react-query";
import Head from "next/head";
import { useRouter } from "next/router";
import { useState, type FormEvent } from "react";
import { LuArrowRight, LuEye, LuEyeOff, LuLock, LuMail } from "react-icons/lu";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Card } from "@/components/ui/Card";
import { PrimaryButton } from "@/components/ui/Buttons";
import { ChakraLink } from "@/components/ui/NextLink";
import { TextField } from "@/components/ui/TextField";
import PawIcon from "@/icons/paw.svg";
import { ApiError } from "@/lib/api";
import { loginUser } from "@/lib/authApi";
import { persistAuthSession } from "@/lib/session";

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_EMAIL: "Введите корректный email.",
  INVALID_CREDENTIALS: "Неверный email или пароль.",
};

const errorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    return ERROR_MESSAGES[error.code] ?? error.message;
  }

  return "Не удалось войти. Попробуйте еще раз.";
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const loginMutation = useMutation({
    mutationFn: () => loginUser({ email: email.trim(), password }),
    onSuccess: (response) => {
      persistAuthSession({
        accessToken: response.accessToken,
        user: response.user,
      });
      router.replace(response.nextStep === "onboarding" ? "/auth?step=pet" : "/pets");
    },
  });

  const canSubmit = Boolean(email.trim() && password && !loginMutation.isPending);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (canSubmit) loginMutation.mutate();
  };

  return (
    <>
      <Head>
        <title>Вход — PawsPort</title>
      </Head>
      <AuthLayout>
        <VStack gap="32px">
          <VStack gap="12px">
            <Box
              rounded="card"
              bg="secondary.600"
              display="flex"
              alignItems="center"
              justifyContent="center"
              color="primary.400"
              borderWidth="1px"
              borderColor="primary.200"
              px="16px"
              py="12px"
              boxShadow="0 4px 15px 0 rgba(59, 130, 246, 0.3)"
            >
              <PawIcon width={30} height={29} />
            </Box>
            <Text fontSize="24px" fontWeight={700}>
              PawsPort
            </Text>
            <Text fontSize="14px" color="fg.muted" textAlign="center">
              Войдите, чтобы продолжить работу с профилями питомцев
            </Text>
          </VStack>

          <Card w="full" maxW="420px" p={["20px", null, "24px"]}>
            <VStack as="form" gap="20px" align="stretch" onSubmit={handleSubmit}>
              <Text fontSize="24px" fontWeight={700}>
                Вход
              </Text>
              <Stack gap="16px">
                <TextField
                  label="Email"
                  type="email"
                  placeholder="name@example.com"
                  startElement={<LuMail />}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <TextField
                  label="Пароль"
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
                  onChange={(event) => setPassword(event.target.value)}
                />
              </Stack>

              {loginMutation.isError && (
                <Box
                  bg="red.950"
                  borderWidth="1px"
                  borderColor="red.700"
                  color="red.100"
                  rounded="field"
                  px="14px"
                  py="10px"
                >
                  <Text fontSize="13px">{errorMessage(loginMutation.error)}</Text>
                </Box>
              )}

              <PrimaryButton type="submit" disabled={!canSubmit} loading={loginMutation.isPending}>
                <HStack gap="8px">
                  <Text>Войти</Text>
                  <LuArrowRight />
                </HStack>
              </PrimaryButton>
              <Text fontSize="14px" color="fg.muted" textAlign="center">
                Нет аккаунта?{" "}
                <ChakraLink href="/auth" color="primary.400" fontWeight={600}>
                  Зарегистрируйтесь
                </ChakraLink>
              </Text>
            </VStack>
          </Card>
        </VStack>
      </AuthLayout>
    </>
  );
}
