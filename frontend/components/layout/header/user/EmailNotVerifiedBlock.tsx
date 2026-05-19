import { Stack, Text } from "@chakra-ui/react";
import { PrimaryButton } from "@/components/ui/Buttons";

type TEmailNotVerifiedBlockProps = {
  onResend: () => void;
  isPending: boolean;
};

export function EmailNotVerifiedBlock({ onResend, isPending }: TEmailNotVerifiedBlockProps) {
  return (
    <Stack gap="8px" px="4px" py="4px">
      <Text fontSize="13px" color="fg.muted" textAlign="center">
        Ваш email не подтвержден
      </Text>
      <PrimaryButton h="36px" onClick={onResend} loading={isPending}>
        Подтвердить
      </PrimaryButton>
    </Stack>
  );
}
