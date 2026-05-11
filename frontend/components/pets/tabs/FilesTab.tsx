import type { ReactNode } from "react";
import {
  Box,
  HStack,
  Heading,
  IconButton,
  Stack,
  Text,
} from "@chakra-ui/react";
import {
  LuCalendar,
  LuDownload,
  LuFileText,
  LuFileImage,
  LuFile,
  LuSearch,
  LuTrash,
  LuUpload,
} from "react-icons/lu";
import { SecondaryButton } from "@/components/ui/Buttons";
import { TextField } from "@/components/ui/TextField";

type TFileRow = {
  name: string;
  type: "pdf" | "image" | "doc";
  size: string;
  date: string;
};

const MOCK_FILES: TFileRow[] = [
  { name: "Общий анализ крови", type: "pdf", size: "1.2 MB", date: "Oct 24, 2025" },
  { name: "Рентген правой задней лапы", type: "image", size: "4.5 MB", date: "Jun 12, 2025" },
  { name: "Титры на бешенство", type: "pdf", size: "850 KB", date: "Mar 05, 2024" },
  { name: "Заключение стоматолога после операции", type: "doc", size: "142 KB", date: "Aug 20, 2024" },
];

const TYPE_META: Record<TFileRow["type"], { icon: ReactNode; bg: string; color: string; ext: string }> = {
  pdf: {
    icon: <LuFileText />,
    bg: "rgba(239, 68, 68, 0.15)",
    color: "#FCA5A5",
    ext: "PDF",
  },
  image: {
    icon: <LuFileImage />,
    bg: "rgba(59, 130, 246, 0.15)",
    color: "#93C5FD",
    ext: "JPG",
  },
  doc: {
    icon: <LuFile />,
    bg: "rgba(16, 185, 129, 0.15)",
    color: "#6EE7B7",
    ext: "DOCX",
  },
};

export function FilesTab() {
  return (
    <Stack gap="24px">
      <HStack justify="space-between" flexWrap="wrap" gap="12px">
        <Stack gap="4px">
          <Heading size="lg">Файлы</Heading>
          <Text color="fg.muted" fontSize="14px">
            Управление и доступ ко всем файлам питомца
          </Text>
        </Stack>
        <SecondaryButton h="44px" px="20px">
          <HStack gap="8px">
            <LuUpload />
            <Text>Загрузить файл</Text>
          </HStack>
        </SecondaryButton>
      </HStack>

      <HStack gap="12px" flexWrap={{ base: "wrap", md: "nowrap" }}>
        <Box flex={1} minW="220px">
          <TextField
            placeholder="Поиск по названию..."
            startElement={<LuSearch />}
            uppercase={false}
          />
        </Box>
        <Box w={{ base: "full", md: "200px" }}>
          <TextField
            placeholder="Период"
            startElement={<LuCalendar />}
            uppercase={false}
          />
        </Box>
      </HStack>

      <Stack gap="8px">
        {MOCK_FILES.map((f) => {
          const meta = TYPE_META[f.type];
          return (
            <HStack
              key={f.name}
              justify="space-between"
              bg="bg.surface"
              borderWidth="1px"
              borderColor="border.subtle"
              rounded="card"
              p="16px"
              gap="12px"
            >
              <HStack gap="12px" flex={1} minW={0}>
                <Box
                  w="40px"
                  h="40px"
                  rounded="lg"
                  bg={meta.bg}
                  color={meta.color}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  flexShrink={0}
                >
                  {meta.icon}
                </Box>
                <Stack gap="0" minW={0}>
                  <Text fontWeight={500} truncate>
                    {f.name}
                  </Text>
                  <Text fontSize="12px" color="fg.muted">
                    {meta.ext} · {f.size} · {f.date}
                  </Text>
                </Stack>
              </HStack>
              <HStack gap="4px">
                <IconButton aria-label="Скачать" size="sm" variant="ghost" color="fg.muted">
                  <LuDownload />
                </IconButton>
                <IconButton aria-label="Удалить" size="sm" variant="ghost" color="fg.muted">
                  <LuTrash />
                </IconButton>
              </HStack>
            </HStack>
          );
        })}
      </Stack>
    </Stack>
  );
}