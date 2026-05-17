import { Box, Checkbox, HStack, IconButton, Stack, Text, VStack } from "@chakra-ui/react";
import { ChakraLink } from "@/components/ui/NextLink";
import { useState, type FormEvent } from "react";
import { LuArrowRight, LuEye, LuEyeOff, LuLock, LuMail } from "react-icons/lu";
import PawIcon from "@/icons/paw.svg";
import { Card } from "@/components/ui/Card";
import { PrimaryButton } from "@/components/ui/Buttons";
import { StepProgress } from "@/components/ui/StepProgress";
import { TextField } from "@/components/ui/TextField";

type TRegisterStepProps = {
  email: string;
  password: string;
  personalDataConsent: boolean;
  isSubmitting?: boolean;
  errorText?: string;
  onChange: (patch: { email?: string; password?: string; personalDataConsent?: boolean }) => void;
  onNext: () => void;
};

export function RegisterStep({
  email,
  password,
  personalDataConsent,
  isSubmitting = false,
  errorText,
  onChange,
  onNext,
}: TRegisterStepProps) {
  const [showPwd, setShowPwd] = useState(false);
  const passwordError =
    password.length > 0 && password.length < 8 ? "Минимум 8 символов." : undefined;
  const canSubmit = Boolean(
    email.trim() && password.length >= 8 && personalDataConsent && !isSubmitting
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (canSubmit) onNext();
  };

  return (
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
          Pawsport
        </Text>
        <Text fontSize="14px" color="fg.muted" textAlign="center">
          Путь к здоровью вашего питомца начинается здесь
        </Text>
      </VStack>

      <Card w="full" maxW="420px" p={["20px", null, "24px"]}>
        <VStack as="form" gap="20px" align="stretch" onSubmit={handleSubmit}>
          <StepProgress current={1} total={3} />
          <Text fontSize="24px" fontWeight={700}>
            Регистрация
          </Text>
          <Stack gap="16px">
            <TextField
              label="Email"
              type="email"
              placeholder="name@example.com"
              startElement={<LuMail />}
              value={email}
              onChange={(e) => onChange({ email: e.target.value })}
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
                  onClick={() => setShowPwd((v) => !v)}
                >
                  {showPwd ? <LuEyeOff /> : <LuEye />}
                </IconButton>
              }
              value={password}
              errorText={passwordError}
              onChange={(e) => onChange({ password: e.target.value })}
            />
          </Stack>
          <Checkbox.Root
            checked={personalDataConsent}
            onCheckedChange={(details) =>
              onChange({ personalDataConsent: Boolean(details.checked) })
            }
            colorPalette="blue"
          >
            <Checkbox.HiddenInput />
            <Checkbox.Control />
            <Checkbox.Label>
              <Text fontSize="13px" color="fg.muted">
                Я согласен на обработку персональных данных
              </Text>
            </Checkbox.Label>
          </Checkbox.Root>
          {errorText && (
            <Box
              bg="red.950"
              borderWidth="1px"
              borderColor="red.700"
              color="red.100"
              rounded="field"
              px="14px"
              py="10px"
            >
              <Text fontSize="13px">{errorText}</Text>
            </Box>
          )}
          <PrimaryButton type="submit" disabled={!canSubmit} loading={isSubmitting}>
            <HStack gap="8px">
              <Text>Далее к созданию питомца</Text>
              <LuArrowRight />
            </HStack>
          </PrimaryButton>
          <Text fontSize="14px" color="fg.muted" textAlign="center">
            Уже есть аккаунт?{" "}
            <ChakraLink href="/auth/login" color="primary.400" fontWeight={600}>
              Войдите
            </ChakraLink>
          </Text>
        </VStack>
      </Card>
    </VStack>
  );
}
