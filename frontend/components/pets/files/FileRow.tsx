import { Box, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { LuDownload, LuTrash } from "react-icons/lu";
import type { TPetFile } from "@/lib/petsApi";
import { formatSize } from "@/utils/files";
import { formatShortDate } from "@/utils/dates";
import { FILE_TYPE_META, getFileKind, getFileTypeLabel } from "./utils";

type TFileRowProps = {
  file: TPetFile;
  busy: boolean;
  disabled: boolean;
  onDownload: () => void;
  onDelete: () => void;
};

export function FileRow({ file, busy, disabled, onDownload, onDelete }: TFileRowProps) {
  const meta = FILE_TYPE_META[getFileKind(file.mimeType)];

  return (
    <HStack
      justify="space-between"
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.subtle"
      rounded="card"
      p="16px"
      gap="12px"
      minH="74px"
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
        <Stack gap="2px" minW={0}>
          <Text fontWeight={500} truncate>
            {file.originalName}
          </Text>
          <Text fontSize="12px" color="fg.muted">
            {getFileTypeLabel(file.mimeType)} · {formatSize(file.sizeBytes)} ·{" "}
            {formatShortDate(file.uploadedAt)}
          </Text>
          <Text fontSize="12px" color="fg.muted">
            {file.eventId ? "Связан с событием" : "Без события"}
          </Text>
        </Stack>
      </HStack>
      <HStack gap="4px" flexShrink={0}>
        <IconButton
          aria-label="Скачать"
          size="sm"
          variant="ghost"
          color="fg.muted"
          disabled={busy || disabled}
          onClick={onDownload}
          _hover={{ color: "fg.default", bg: "secondary.700" }}
        >
          <LuDownload />
        </IconButton>
        <IconButton
          aria-label="Удалить"
          size="sm"
          variant="ghost"
          color="fg.muted"
          disabled={busy || disabled}
          onClick={onDelete}
          _hover={{ color: "status.danger", bg: "secondary.700" }}
        >
          <LuTrash />
        </IconButton>
      </HStack>
    </HStack>
  );
}
