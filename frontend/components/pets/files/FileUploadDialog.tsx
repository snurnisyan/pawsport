import { useEffect, useState } from "react";
import { Box, HStack, Icon, IconButton, Stack, Text } from "@chakra-ui/react";
import { LuFile, LuX } from "react-icons/lu";
import { DialogActions } from "@/components/ui/DialogActions";
import { DialogShell } from "@/components/ui/DialogShell";
import { FileDropZone } from "@/components/ui/FileDropZone";

type TFileUploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (files: File[]) => void;
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function FileUploadDialog({ open, onOpenChange, onSubmit }: TFileUploadDialogProps) {
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!open) setFiles([]);
  }, [open]);

  const removeAt = (index: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== index));

  const handleSave = () => {
    if (files.length === 0) return;
    onSubmit?.(files);
    onOpenChange(false);
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Загрузка файлов"
      subtitle="К карточке питомца"
      footer={
        <DialogActions
          onCancel={() => onOpenChange(false)}
          onSave={handleSave}
          saveDisabled={files.length === 0}
        />
      }
    >
      <Stack gap="16px">
        <FileDropZone
          multiple
          accept=".pdf,image/*,.doc,.docx"
          onFiles={(picked) => setFiles((prev) => [...prev, ...picked])}
          subtitle="PDF, PNG, JPG, DOCX (макс. 20MB)"
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
