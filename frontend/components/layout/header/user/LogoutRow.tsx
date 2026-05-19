import { Box, Text } from "@chakra-ui/react";
import { LuLogOut } from "react-icons/lu";
import { Pressable } from "@/components/ui/Pressable";

type TLogoutRowProps = {
  onClick: () => void;
};

export function LogoutRow({ onClick }: TLogoutRowProps) {
  return (
    <Pressable
      type="button"
      onClick={onClick}
      display="flex"
      alignItems="center"
      gap="10px"
      w="full"
      px="12px"
      py="10px"
      rounded="md"
      color="fg.default"
      cursor="pointer"
      _hover={{ bg: "secondary.700" }}
    >
      <Box color="fg.muted" fontSize="16px">
        <LuLogOut />
      </Box>
      <Text fontSize="14px">Выйти</Text>
    </Pressable>
  );
}
