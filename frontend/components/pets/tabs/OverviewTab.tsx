import type { ReactNode } from "react";
import {
  Box,
  Grid,
  GridItem,
  HStack,
  Icon,
  IconButton,
  Stack,
  Text,
} from "@chakra-ui/react";
import {
  LuFileText,
  LuMail,
  LuPenLine,
  LuPhone,
  LuStethoscope,
  LuSyringe,
  LuUser,
} from "react-icons/lu";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import type { TPet } from "@/store/pets";

type TCardHeaderProps = {
  icon: ReactNode;
  title: string;
  iconBg?: string;
  iconColor?: string;
};

type TOverviewTabProps = {
  pet: TPet;
};

function CardHeader({ icon,
                      title,
                      iconBg = "secondary.700",
                      iconColor = "primary.400" }: TCardHeaderProps) {
  return (
    <HStack justify="space-between" mb="20px">
      <HStack gap="12px">
        <Box
          w="32px"
          h="32px"
          rounded="lg"
          bg={iconBg}
          color={iconColor}
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Icon boxSize="16px">{icon}</Icon>
        </Box>
        <Text fontWeight={700}>{title}</Text>
      </HStack>
      <IconButton
        aria-label="Редактировать"
        size="xs"
        variant="ghost"
        color="fg.muted"
      >
        <LuPenLine />
      </IconButton>
    </HStack>
  );
}

export function OverviewTab({ pet }: TOverviewTabProps) {
  return (
    <Grid
      templateColumns={{ base: "1fr", lg: "2fr 1fr" }}
      gap="20px"
    >
      <GridItem>
        <Stack gap="20px">
          <Card>
            <CardHeader icon={<LuUser />} title="Обзор" />
            <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="16px">
              <TextField
                label="Номер чипа"
                defaultValue={pet.chipNumber}
                readOnly
              />
              <TextField
                label="Дата рождения"
                defaultValue={pet.birthDate}
                readOnly
              />
              <TextField
                label="Пол"
                defaultValue={pet.sex === "male" ? "Мальчик" : "Девочка"}
                readOnly
              />
              <TextField label="Вес" defaultValue={`${pet.weightKg} кг`} readOnly />
              <Box gridColumn={{ base: "auto", sm: "1 / -1" }}>
                <TextField label="Порода" defaultValue={pet.breed} readOnly />
              </Box>
            </Grid>
          </Card>

          <Card>
            <CardHeader
              icon={<LuSyringe />}
              title="Вакцины и обработки"
              iconBg="rgba(168, 85, 247, 0.15)"
              iconColor="#D8B4FE"
            />
            <Stack gap="12px">
              {[
                { name: "Бешенство (Nobivac)", date: "Июнь 2026", until: "Действует до: июнь 2026" },
                { name: "Внешние паразиты", date: "Апрель 2026", until: "Действует до: май 2026" },
              ].map((v) => (
                <HStack
                  key={v.name}
                  justify="space-between"
                  bg="secondary.700"
                  rounded="lg"
                  p="16px"
                >
                  <HStack gap="12px">
                    <Box
                      w="28px"
                      h="28px"
                      rounded="md"
                      bg="secondary.500"
                      color="fg.muted"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Icon boxSize="14px">
                        <LuFileText />
                      </Icon>
                    </Box>
                    <Stack gap="0">
                      <Text fontWeight={500} fontSize="14px">
                        {v.name}
                      </Text>
                      <Text fontSize="12px" color="fg.muted">
                        {v.date}
                      </Text>
                    </Stack>
                  </HStack>
                  <Text fontSize="12px" color="fg.muted">
                    {v.until}
                  </Text>
                </HStack>
              ))}
            </Stack>
          </Card>
        </Stack>
      </GridItem>

      <GridItem>
        <Stack gap="20px">
          <Card>
            <CardHeader
              icon={<LuFileText />}
              title="Заметки"
              iconBg="rgba(20, 184, 166, 0.15)"
              iconColor="#5EEAD4"
            />
            <Stack gap="8px">
              {pet.notes.length === 0 && (
                <Text fontSize="14px" color="fg.muted">
                  Нет заметок
                </Text>
              )}
              {pet.notes.map((n) => (
                <Box
                  key={n}
                  bg="secondary.700"
                  rounded="md"
                  px="12px"
                  py="8px"
                  fontSize="14px"
                >
                  {n}
                </Box>
              ))}
            </Stack>
          </Card>

          {pet.vet && (
            <Card>
              <CardHeader
                icon={<LuStethoscope />}
                title="Ветеринар"
                iconBg="rgba(59, 130, 246, 0.15)"
                iconColor="#93C5FD"
              />
              <Stack gap="12px">
                <Text fontWeight={600}>{pet.vet.name}</Text>
                <HStack color="fg.muted" fontSize="14px" gap="8px">
                  <LuPhone />
                  <Text>{pet.vet.phone}</Text>
                </HStack>
                <HStack color="fg.muted" fontSize="14px" gap="8px">
                  <LuMail />
                  <Text>{pet.vet.email}</Text>
                </HStack>
              </Stack>
            </Card>
          )}
        </Stack>
      </GridItem>
    </Grid>
  );
}