import { Box, Flex, Heading, Stack, Text } from "@chakra-ui/react";
import { Footer } from "@/components/layout/Footer";
import { PrimaryButton } from "@/components/ui/Buttons";
import { Logo } from "@/components/ui/Logo";
import { ChakraLink } from "@/components/ui/NextLink";

export default function NotFoundPage() {
  return (
    <Flex direction="column" minH="100vh" w="100%" bg="bg.canvas">
      <Box
        as="header"
        borderBottomWidth="1px"
        borderColor="border.subtle"
        px={["16px", null, "24px"]}
        py="12px"
      >
        <Logo size="sm" />
      </Box>

      <Flex
        flex="1"
        w="100%"
        align="center"
        justify="center"
        px={["16px", null, "24px"]}
        py="32px"
      >
        <Stack align="center" gap="20px" maxW="480px" textAlign="center">
          <Text
            fontFamily="heading"
            fontSize={["96px", null, "128px"]}
            fontWeight={800}
            lineHeight="1"
            color="fg.accent"
            textShadow="0 0 32px rgba(59, 130, 246, 0.45)"
          >
            404
          </Text>
          <Heading as="h1" fontSize={["24px", null, "28px"]} color="fg.default">
            Страница не найдена
          </Heading>
          <Text fontSize="14px" color="fg.muted">
            Кажется, эта страница убежала на прогулку. Проверьте адрес или
            вернитесь на главную.
          </Text>
          <ChakraLink href="/" _hover={{ textDecoration: "none" }}>
            <PrimaryButton px="24px">На главную</PrimaryButton>
          </ChakraLink>
        </Stack>
      </Flex>

      <Footer />
    </Flex>
  );
}
