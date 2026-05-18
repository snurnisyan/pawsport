import { Box, Text } from "@chakra-ui/react";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <Box
      as="footer"
      w="100%"
      px="24px"
      py="12px"
      textAlign="center"
      color="fg.muted"
      fontSize="12px"
      borderTopWidth="1px"
      borderColor="border.subtle"
    >
      <Text>© {year} Pawsport · snurnisyan</Text>
    </Box>
  );
}
