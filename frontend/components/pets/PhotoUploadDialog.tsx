import { useEffect, useMemo, useState } from "react";
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
  onSave: (file: File) => void | Promise<void>;
  petName: string;
  isPending?: boolean;
};

export function PhotoUploadDialog({
  open,
  onOpenChange,
  onSave,
  petName,
  isPending = false,
}: TPhotoUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const closeDialog = () => {
    if (isPending) return;
    setFile(null);
    onOpenChange(false);
  };

  const handleSave = async () => {
    if (!file || isPending) return;
    try {
      await onSave(file);
      setFile(null);
      onOpenChange(false);
    } catch {
      // The parent mutation owns the visible error state and keeps the dialog open.
    }
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={(nextOpen) => {
        if (isPending) return;
        if (!nextOpen) {
          closeDialog();
          return;
        }
        onOpenChange(true);
      }}
      title={`Загрузить фото — ${petName}`}
      footer={
        <DialogActions
          onCancel={closeDialog}
          onSave={handleSave}
          cancelDisabled={isPending}
          saveDisabled={!file || isPending}
          saveLabel={isPending ? "Сохраняем..." : "Сохранить"}
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
              disabled={isPending}
              _hover={{ bg: "bg.canvas" }}
            >
              <LuX />
            </IconButton>
          </Box>
          <HStack gap="8px" color="fg.muted" fontSize="14px">
            <Icon>
              <LuImage />
            </Icon>
            <Text truncate>{file?.name}</Text>
          </HStack>
        </Stack>
      ) : (
        <FileDropZone
          accept="image/png,image/jpeg"
          onFiles={(files) => {
            if (!isPending) setFile(files[0]);
          }}
          title="Нажмите, чтобы выбрать фото"
          subtitle="PNG, JPG"
          height="240px"
        />
      )}
    </DialogShell>
  );
}
