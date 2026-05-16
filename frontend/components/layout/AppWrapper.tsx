import type { ReactNode } from "react";
import { Box, Container } from "@chakra-ui/react";
import { Header } from "./Header";

type TAppWrapperProps = {
  children: ReactNode;
  maxW?: string;
};

export function AppWrapper({ children, maxW = "1280px" }: TAppWrapperProps) {
  return (
    <Box minH="100vh" bg="bg.canvas">
      <Header />
      <Container maxW={maxW} px={["16px", null, "24px"]} py={["24px", null, "40px"]}>
        {children}
      </Container>
    </Box>
  );
}