import { useState } from "react";
import { Box, Stack, Text } from "@chakra-ui/react";
import { LuPlus } from "react-icons/lu";
import { Pressable } from "@/components/ui/Pressable";
import { AddPetDialog } from "@/components/pets/AddPetDialog";

export function AddPetCard() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        type="button"
        onClick={() => setOpen(true)}
        borderWidth="2px"
        borderStyle="dashed"
        borderColor="border.default"
        bg="transparent"
        rounded="card"
        p="32px"
        minH="320px"
        display="flex"
        alignItems="center"
        justifyContent="center"
        cursor="pointer"
        transition="all 0.15s"
        color="fg.muted"
        _hover={{ borderColor: "primary.500", color: "primary.400" }}
      >
        <Stack gap="12px" align="center" textAlign="center">
          <Box
            w="48px"
            h="48px"
            rounded="full"
            bg="secondary.700"
            display="flex"
            alignItems="center"
            justifyContent="center"
            color="primary.400"
            fontSize="20px"
          >
            <LuPlus />
          </Box>
          <Text fontWeight={600} color="fg.default">
            Добавить питомца
          </Text>
          <Text fontSize="14px" color="fg.muted" maxW="180px">
            Добавьте нового питомца для отслеживания
          </Text>
        </Stack>
      </Pressable>

      <AddPetDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
