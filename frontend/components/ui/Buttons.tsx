import { Button, type ButtonProps } from "@chakra-ui/react";

export function PrimaryButton(props: ButtonProps) {
  return (
    <Button
      bg="primary.500"
      color="white"
      rounded="field"
      h="48px"
      fontWeight="semibold"
      boxShadow="glow"
      _hover={{ bg: "primary.600", boxShadow: "glow" }}
      _active={{ bg: "primary.700" }}
      _disabled={{ opacity: 0.4, cursor: "not-allowed", boxShadow: "none" }}
      {...props}
    />
  );
}

export function SecondaryButton(props: ButtonProps) {
  return (
    <Button
      variant="outline"
      bg="secondary.700"
      color="fg.default"
      borderColor="border.default"
      rounded="field"
      h="48px"
      fontWeight="medium"
      _hover={{ bg: "secondary.600", borderColor: "border.accent" }}
      {...props}
    />
  );
}

export function GhostButton(props: ButtonProps) {
  return (
    <Button
      variant="ghost"
      color="fg.muted"
      rounded="field"
      h="44px"
      _hover={{ color: "fg.default", bg: "secondary.700" }}
      {...props}
    />
  );
}
