import { Icon, Text } from "@chakra-ui/react";
import { LuPawPrint } from "react-icons/lu";
import { ChakraLink } from "@/components/ui/NextLink";

type TLogoProps = {
  href?: string;
  size?: "sm" | "md";
};

export function Logo({ href = "/pets", size = "md" }: TLogoProps) {
  const fontSize = size === "sm" ? "md" : "lg";
  const iconSize = size === "sm" ? 4 : 5;
  return (
    <ChakraLink
      href={href}
      display="inline-flex"
      alignItems="center"
      gap={2}
      color="primary.400"
    >
      <Icon boxSize={iconSize}>
        <LuPawPrint />
      </Icon>
      <Text fontSize={fontSize} fontWeight="bold" letterSpacing="-0.01em">
        PawsPort
      </Text>
    </ChakraLink>
  );
}
