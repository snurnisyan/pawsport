import type { ReactNode } from "react";
import { Badge } from "@chakra-ui/react";

type TTone = "danger" | "warning" | "success" | "info" | "purple" | "teal";

type TStatusBadgeProps = {
  tone?: TTone;
  children: ReactNode;
};

const STYLES: Record<TTone, { bg: string; color: string }> = {
  danger: { bg: "rgba(239, 68, 68, 0.15)", color: "#FCA5A5" },
  warning: { bg: "rgba(245, 158, 11, 0.15)", color: "#FCD34D" },
  success: { bg: "rgba(16, 185, 129, 0.15)", color: "#6EE7B7" },
  info: { bg: "rgba(59, 130, 246, 0.15)", color: "#93C5FD" },
  purple: { bg: "rgba(168, 85, 247, 0.18)", color: "#D8B4FE" },
  teal: { bg: "rgba(20, 184, 166, 0.18)", color: "#5EEAD4" },
};

export function StatusBadge({ tone = "info", children }: TStatusBadgeProps) {
  const s = STYLES[tone];
  return (
    <Badge
      bg={s.bg}
      color={s.color}
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