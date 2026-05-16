import type { ReactNode } from "react";
import { Box, HStack, Icon, IconButton, Text } from "@chakra-ui/react";
import { LuPenLine } from "react-icons/lu";

type TSectionCardHeaderProps = {
  icon: ReactNode;
  title: string;
  iconBg?: string;
  iconColor?: string;
  editing?: boolean;
  onEditClick?: () => void;
};

export function SectionCardHeader({ icon,
                                    title,
                                    iconBg = "secondary.700",
                                    iconColor = "primary.400",
                                    editing = false,
                                    onEditClick }: TSectionCardHeaderProps) {
  return (
    <HStack justify="space-between" mb="20px">
      <HStack gap="12px">
        <Box
          w="32px"
          h="32px"
          rounded="lg"
          bg={iconBg}
          color={iconColor}
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Icon boxSize="16px">{icon}</Icon>
        </Box>
        <Text fontWeight={700}>{title}</Text>
      </HStack>
      {onEditClick && !editing && (
        <IconButton
          aria-label="Редактировать"
          size="xs"
          variant="ghost"
          color="fg.muted"
          onClick={onEditClick}
          _hover={{ color: "fg.default", bg: "secondary.700" }}
        >
          <LuPenLine />
        </IconButton>
      )}
    </HStack>
  );
}
