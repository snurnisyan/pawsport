import { Box, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { LuFileText, LuSyringe } from "react-icons/lu";
import { Card } from "@/components/ui/Card";
import { SectionCardHeader } from "./SectionCardHeader";

const VACCINES = [
  { name: "Бешенство (Nobivac)", date: "Июнь 2026", until: "Действует до: июнь 2026" },
  { name: "Внешние паразиты", date: "Апрель 2026", until: "Действует до: май 2026" },
];

export function VaccinesSection() {
  return (
    <Card>
      <SectionCardHeader icon={<LuSyringe />} title="Вакцины и обработки" />
      <Stack gap="12px">
        {VACCINES.map((v) => (
          <HStack
            key={v.name}
            justify="space-between"
            bg="secondary.700"
            rounded="lg"
            p="16px"
          >
            <HStack gap="12px">
              <Box
                w="28px"
                h="28px"
                rounded="md"
                bg="secondary.500"
                color="fg.muted"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Icon boxSize="14px">
                  <LuFileText />
                </Icon>
              </Box>
              <Stack gap="0">
                <Text fontWeight={500} fontSize="14px">
                  {v.name}
                </Text>
                <Text fontSize="12px" color="fg.muted">
                  {v.date}
                </Text>
              </Stack>
            </HStack>
            <Text fontSize="12px" color="fg.muted">
              {v.until}
            </Text>
          </HStack>
        ))}
      </Stack>
    </Card>
  );
}
