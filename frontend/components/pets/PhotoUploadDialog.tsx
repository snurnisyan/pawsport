import { useEffect, useRef, useState } from "react";
import {
  Box,
  Dialog,
  HStack,
  Icon,
  IconButton,
  Image,
  Stack,
  Text,
} from "@chakra-ui/react";
import { LuImage, LuUpload, LuX } from "react-icons/lu";
import { GhostButton, PrimaryButton } from "@/components/ui/Buttons";
import { Pressable } from "@/components/ui/Pressable";

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
  const inputRef = useRef<HTMLInputElement>(null);
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
    if (!open) {
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [open]);

  const pickFile = () => inputRef.current?.click();

  const handleSave = () => {
    if (!file) return;
    onSave(file);
    onOpenChange(false);
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(d) => onOpenChange(d.open)}
      placement="center"
    >
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content bg="bg.surface" borderColor="border.subtle" borderWidth="1px" rounded="card" maxW="480px" mx="16px">
          <Dialog.Header px="24px" pt="24px" pb="16px">
            <Dialog.Title>Загрузить фото — {petName}</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body px="24px" pb="8px">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const next = e.target.files?.[0] ?? null;
                setFile(next);
              }}
            />
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
              <Pressable
                type="button"
                onClick={pickFile}
                w="full"
                h="240px"
                rounded="card"
                borderWidth="2px"
                borderStyle="dashed"
                borderColor="border.default"
                bg="bg.field"
                color="fg.muted"
                display="flex"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                gap="12px"
                cursor="pointer"
                transition="all 0.15s"
                _hover={{ borderColor: "primary.500", color: "primary.400" }}
              >
                <Icon boxSize="32px"><LuUpload /></Icon>
                <Stack gap="4px" align="center">
                  <Text fontSize="14px" fontWeight={600}>
                    Нажмите, чтобы выбрать фото
                  </Text>
                  <Text fontSize="12px">PNG, JPG, GIF</Text>
                </Stack>
              </Pressable>
            )}
          </Dialog.Body>
          <Dialog.Footer px="24px" pt="16px" pb="24px">
            <HStack gap="12px" w="full">
              <GhostButton flex={1} onClick={() => onOpenChange(false)}>
                Отменить
              </GhostButton>
              <PrimaryButton flex={1} onClick={handleSave} disabled={!file}>
                Сохранить
              </PrimaryButton>
            </HStack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
