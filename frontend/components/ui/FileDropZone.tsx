import { useRef, type DragEvent, type ReactNode } from "react";
import { Icon, Stack, Text } from "@chakra-ui/react";
import { LuCloudUpload } from "react-icons/lu";
import { Pressable } from "@/components/ui/Pressable";

type TFileDropZoneProps = {
  accept?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  height?: string;
};

export function FileDropZone({ accept,
                                multiple = false,
                                onFiles,
                                title = "Нажмите, чтобы загрузить, или перетащите файл",
                                subtitle,
                                icon = <LuCloudUpload />,
                                height = "200px" }: TFileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const emit = (files: File[]) => {
    if (files.length === 0) return;
    onFiles(multiple ? files : [files[0]]);
  };

  const handleDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    emit(Array.from(e.dataTransfer.files));
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          emit(Array.from(e.target.files ?? []));
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      <Pressable
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        w="full"
        h={height}
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
        <Icon boxSize="28px" color="primary.400">
          {icon}
        </Icon>
        <Stack gap="4px" align="center" px="16px">
          <Text fontSize="14px" fontWeight={500} textAlign="center">
            {title}
          </Text>
          {subtitle && (
            <Text fontSize="12px" textTransform="uppercase" letterSpacing="0.08em" textAlign="center">
              {subtitle}
            </Text>
          )}
        </Stack>
      </Pressable>
    </>
  );
}
