import { HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { LuFile } from "react-icons/lu";
import type { TExistingEventFile } from "@/components/pets/events/EventForm";

type TFilesListProps = {
  files: TExistingEventFile[];
};

export function FilesList({ files }: TFilesListProps) {
  return (
    <Stack gap="6px">
      {files.map((f, i) => (
        <HStack
          key={`${f.fileId}-${i}`}
          gap="8px"
          bg="secondary.700"
          rounded="md"
          px="10px"
          py="6px"
        >
          <Icon color="primary.400" boxSize="14px">
            <LuFile />
          </Icon>
          <Text fontSize="13px" truncate>
            {f.originalName}
          </Text>
        </HStack>
      ))}
    </Stack>
  );
}
