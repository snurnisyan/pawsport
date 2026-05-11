import { Box, HStack, Icon, IconButton, Stack, Text, VStack } from "@chakra-ui/react";
import { ChakraLink } from "@/components/ui/NextLink";
import { useState } from "react";
import { LuArrowRight, LuEye, LuEyeOff, LuLock, LuMail, LuPawPrint } from "react-icons/lu";
import { Card } from "@/components/ui/Card";
import { PrimaryButton } from "@/components/ui/Buttons";
import { StepProgress } from "@/components/ui/StepProgress";
import { TextField } from "@/components/ui/TextField";

type TRegisterStepProps = {
  email: string;
  password: string;
  onChange: (patch: { email?: string; password?: string }) => void;
  onNext: () => void;
};

export function RegisterStep({ email, password, onChange, onNext }: TRegisterStepProps) {
  const [showPwd, setShowPwd] = useState(false);

  return (
    <VStack gap={8}>
      <VStack gap={3}>
        <Box
          w="56px"
          h="56px"
          rounded="card"
          bg="secondary.700"
          display="flex"
          alignItems="center"
          justifyContent="center"
          color="primary.400"
        >
          <Icon boxSize={6}>
            <LuPawPrint />
          </Icon>
        </Box>
        <Text fontSize="2xl" fontWeight="bold">
          PawsPort
        </Text>
        <Text fontSize="sm" color="fg.muted" textAlign="center">
          Путь к здоровью вашего питомца начинается здесь
        </Text>
      </VStack>

      <Card w="full" maxW="420px" p={{ base: 5, md: 6 }}>
        <VStack gap={5} align="stretch">
          <StepProgress current={1} total={3} />
          <Text fontSize="2xl" fontWeight="bold">
            Регистрация
          </Text>
          <Stack gap={4}>
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
              onChange={(e) => onChange({ password: e.target.value })}
            />
          </Stack>
          <PrimaryButton onClick={onNext}>
            <HStack gap={2}>
              <Text>Далее к созданию питомца</Text>
              <LuArrowRight />
            </HStack>
          </PrimaryButton>
          <Text fontSize="sm" color="fg.muted" textAlign="center">
            Уже есть аккаунт?{" "}
            <ChakraLink href="/auth/login" color="primary.400" fontWeight="semibold">
              Войдите
            </ChakraLink>
          </Text>
        </VStack>
      </Card>
    </VStack>
  );
}
