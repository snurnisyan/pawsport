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
      <Container maxW={maxW} px={{ base: 4, md: 6 }} py={{ base: 6, md: 10 }}>
        {children}
      </Container>
    </Box>
  );
}