import type { ReactNode } from "react";
import { Badge } from "@chakra-ui/react";

type TStatusBadgeProps = {
  children: ReactNode;
  styleColors: { bg: string; color: string };
};

export function StatusBadge({ styleColors, children }: TStatusBadgeProps) {
  return (
    <Badge
      bg={styleColors.bg}
      color={styleColors.color}
      px="12px"
      py="4px"
      rounded="full"
      fontSize="10px"
      fontWeight={700}
      letterSpacing="0.06em"
      textTransform="uppercase"
      borderWidth="0"
    >
      {children}
    </Badge>
  );
}
