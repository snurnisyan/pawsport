import { Icon, Text } from "@chakra-ui/react";
import { ChakraLink } from "@/components/ui/NextLink";
import PawIcon from "@/icons/paw.svg";

type TLogoProps = {
  href?: string;
  size?: "sm" | "md";
};

export function Logo({ href = "/pets", size = "md" }: TLogoProps) {
  const fontSize = size === "sm" ? "16px" : "18px";
  const iconSize = size === "sm" ? "16px" : "20px";
  return (
    <ChakraLink
      href={href}
      display="inline-flex"
      alignItems="center"
      gap="8px"
      color="primary.400"
    >
      <Icon boxSize={iconSize}>
        <PawIcon />
      </Icon>
      <Text fontSize={fontSize} fontWeight={700} color={"fg.accent"}>
        PawsPort
      </Text>
    </ChakraLink>
  );
}
