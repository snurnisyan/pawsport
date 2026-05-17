import { useState } from "react";
import { Box, HStack, Icon, IconButton, Stack, Text } from "@chakra-ui/react";
import { LuFile, LuX } from "react-icons/lu";
import { GhostButton, PrimaryButton } from "@/components/ui/Buttons";
import { DialogShell } from "@/components/ui/DialogShell";
import { FileDropZone } from "@/components/ui/FileDropZone";

type TFileUploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (files: File[]) => void | Promise<void>;
  isPending?: boolean;
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function FileUploadDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending = false,
}: TFileUploadDialogProps) {
  const [files, setFiles] = useState<File[]>([]);

  const close = () => {
    setFiles([]);
    onOpenChange(false);
  };

  const removeAt = (index: number) => {
    if (isPending) return;
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (files.length === 0) return;
    try {
      await onSubmit?.(files);
      setFiles([]);
    } catch {
      // The parent mutation owns the visible error state and keeps the dialog open.
    }
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending && !nextOpen) close();
      }}
      title="Загрузка файлов"
      subtitle="К карточке питомца"
      footer={
        <HStack gap="12px" w="full">
          <GhostButton flex={1} onClick={close} disabled={isPending}>
            Закрыть
          </GhostButton>
          <PrimaryButton
            flex={1}
            onClick={handleSave}
            disabled={files.length === 0 || isPending}
          >
            Сохранить
          </PrimaryButton>
        </HStack>
      }
    >
      <Stack gap="16px">
        <FileDropZone
          multiple
          accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg"
          onFiles={(picked) => {
            if (!isPending) setFiles((prev) => [...prev, ...picked]);
          }}
          subtitle="PDF, PNG, JPG (макс. 20MB)"
          height="180px"
        />

        {files.length > 0 && (
          <Stack gap="8px">
            {files.map((file, index) => (
              <HStack
                key={`${file.name}-${index}`}
                bg="bg.field"
                borderWidth="1px"
                borderColor="border.subtle"
                rounded="field"
                p="12px"
                gap="12px"
              >
                <Box
                  w="36px"
                  h="36px"
                  rounded="md"
                  bg="secondary.700"
                  color="primary.400"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  flexShrink={0}
                >
                  <Icon><LuFile /></Icon>
                </Box>
                <Stack gap="0" flex={1} minW={0}>
                  <Text fontSize="14px" fontWeight={500} truncate>
                    {file.name}
                  </Text>
                  <Text fontSize="12px" color="fg.muted">
                    {formatSize(file.size)}
                  </Text>
                </Stack>
                <IconButton
                  aria-label="Убрать файл"
                  size="sm"
                  variant="ghost"
                  color="fg.muted"
                  onClick={() => removeAt(index)}
                  disabled={isPending}
                  _hover={{ color: "fg.default", bg: "secondary.700" }}
                >
                  <LuX />
                </IconButton>
              </HStack>
            ))}
          </Stack>
        )}
      </Stack>
    </DialogShell>
  );
}
