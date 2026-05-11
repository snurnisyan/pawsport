import { Box, type BoxProps } from "@chakra-ui/react";

export function Card(props: BoxProps) {
  return (
    <Box
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.subtle"
      rounded="card"
      p={6}
      shadow="card"
      {...props}
    />
  );
}
