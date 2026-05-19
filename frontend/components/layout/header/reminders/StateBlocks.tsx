import { Box, Stack, Text } from "@chakra-ui/react";
import { LuBell } from "react-icons/lu";
import { apiErrorMessage } from "@/utils/apiErrorMessage";

export function EmptyRemindersBlock() {
  return (
    <Stack align="center" gap="6px" py="12px">
      <Box color="fg.muted" fontSize="20px">
        <LuBell />
      </Box>
      <Text fontSize="13px" color="fg.muted">
        Нет напоминаний
      </Text>
    </Stack>
  );
}

export function ReminderLoadingBlock() {
  return (
    <Stack gap="6px" py="12px">
      <Text fontSize="13px" color="fg.muted">
        Загружаем напоминания...
      </Text>
    </Stack>
  );
}

export function ReminderErrorBlock({ error }: { error: unknown }) {
  return (
    <Stack gap="4px" py="8px">
      <Text fontSize="13px" fontWeight={700} color="red.200">
        Не удалось загрузить напоминания
      </Text>
      <Text fontSize="12px" color="fg.muted">
        {apiErrorMessage(error, "Попробуйте обновить страницу.")}
      </Text>
    </Stack>
  );
}
