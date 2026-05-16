import { useEffect, useState } from "react";
import {
  Box,
  HStack,
  Icon,
  IconButton,
  Image,
  Stack,
  Text,
} from "@chakra-ui/react";
import { LuImage, LuX } from "react-icons/lu";
import { DialogActions } from "@/components/ui/DialogActions";
import { DialogShell } from "@/components/ui/DialogShell";
import { FileDropZone } from "@/components/ui/FileDropZone";

type TPhotoUploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (file: File) => void;
  petName: string;
};

export function PhotoUploadDialog({ open,
                                    onOpenChange,
                                    onSave,
                                    petName }: TPhotoUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!open) setFile(null);
  }, [open]);

  const handleSave = () => {
    if (!file) return;
    onSave(file);
    onOpenChange(false);
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={`Загрузить фото — ${petName}`}
      footer={
        <DialogActions
          onCancel={() => onOpenChange(false)}
          onSave={handleSave}
          saveDisabled={!file}
        />
      }
    >
      {previewUrl ? (
        <Stack gap="12px">
          <Box
            position="relative"
            rounded="card"
            overflow="hidden"
            borderWidth="1px"
            borderColor="border.subtle"
            h="240px"
          >
            <Image
              src={previewUrl}
              alt="Предпросмотр"
              objectFit="cover"
              w="full"
              h="full"
            />
            <IconButton
              aria-label="Убрать фото"
              position="absolute"
              top="8px"
              right="8px"
              size="sm"
              rounded="full"
              bg="bg.canvas/85"
              color="fg.default"
              backdropFilter="blur(8px)"
              onClick={() => setFile(null)}
              _hover={{ bg: "bg.canvas" }}
            >
              <LuX />
            </IconButton>
          </Box>
          <HStack gap="8px" color="fg.muted" fontSize="14px">
            <Icon><LuImage /></Icon>
            <Text truncate>{file?.name}</Text>
          </HStack>
        </Stack>
      ) : (
        <FileDropZone
          accept="image/png,image/jpeg"
          onFiles={(files) => setFile(files[0])}
          title="Нажмите, чтобы выбрать фото"
          subtitle="PNG, JPG"
          height="240px"
        />
      )}
    </DialogShell>
  );
}
