import { Box, HStack, Icon, SimpleGrid, Stack, Text, VStack } from "@chakra-ui/react";
import { LuArrowRight, LuCamera, LuCat, LuDog, LuEllipsis, LuSearch } from "react-icons/lu";
import { FaMars, FaVenus } from "react-icons/fa6";
import { ChoiceCard } from "@/components/ui/ChoiceCard";
import { Pressable } from "@/components/ui/Pressable";
import { PrimaryButton } from "@/components/ui/Buttons";
import { StepProgress } from "@/components/ui/StepProgress";
import { TextField } from "@/components/ui/TextField";

export type TPetSpecies = "dog" | "cat" | "other";
export type TPetSex = "male" | "female";

export type TPetData = {
  name: string;
  species: TPetSpecies | null;
  breed: string;
  sex: TPetSex | null;
};

type TPetStepProps = {
  data: TPetData;
  onChange: (patch: Partial<TPetData>) => void;
  onNext: () => void;
};

export function PetStep({ data, onChange, onNext }: TPetStepProps) {
  return (
    <VStack gap={8} align="stretch" w="full" maxW="640px" mx="auto">
      <VStack gap={2} align="center">
        <StepProgress current={2} total={3} />
        <Text fontSize={{ base: "3xl", md: "4xl" }} fontWeight="bold" mt={6}>
          Первый питомец
        </Text>
        <Text color="fg.muted">Коротко расскажи о своем питомце</Text>
      </VStack>

      <VStack gap={3}>
        <Pressable
          type="button"
          w="120px"
          h="120px"
          rounded="full"
          borderWidth="2px"
          borderStyle="dashed"
          borderColor="border.default"
          color="fg.muted"
          display="flex"
          alignItems="center"
          justifyContent="center"
          bg="transparent"
          cursor="pointer"
          _hover={{ borderColor: "primary.500", color: "primary.400" }}
          transition="all 0.15s"
        >
          <Icon boxSize={8}>
            <LuCamera />
          </Icon>
        </Pressable>
        <Text
          fontSize="xs"
          letterSpacing="0.12em"
          textTransform="uppercase"
          color="fg.muted"
        >
          Загрузите фото (необязательно)
        </Text>
      </VStack>

      <Stack gap={5}>
        <TextField
          label="Имя"
          placeholder="Луна"
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />

        <Box>
          <Text
            fontSize="xs"
            fontWeight="semibold"
            color="fg.muted"
            textTransform="uppercase"
            letterSpacing="0.08em"
            mb={2}
          >
            Вид
          </Text>
          <SimpleGrid columns={3} gap={3}>
            <ChoiceCard
              fullWidth
              icon={<LuDog />}
              label="Собака"
              selected={data.species === "dog"}
              onSelect={() => onChange({ species: "dog" })}
            />
            <ChoiceCard
              fullWidth
              icon={<LuCat />}
              label="Кошка"
              selected={data.species === "cat"}
              onSelect={() => onChange({ species: "cat" })}
            />
            <ChoiceCard
              fullWidth
              icon={<LuEllipsis />}
              label="Другое"
              selected={data.species === "other"}
              onSelect={() => onChange({ species: "other" })}
            />
          </SimpleGrid>
        </Box>

        <TextField
          label="Порода (необязательно)"
          placeholder="Бигль"
          endElement={<LuSearch />}
          value={data.breed}
          onChange={(e) => onChange({ breed: e.target.value })}
        />

        <Box>
          <Text
            fontSize="xs"
            fontWeight="semibold"
            color="fg.muted"
            textTransform="uppercase"
            letterSpacing="0.08em"
            mb={2}
          >
            Пол
          </Text>
          <SimpleGrid columns={2} gap={3}>
            <ChoiceCard
              fullWidth
              icon={<FaMars />}
              label="Мальчик"
              selected={data.sex === "male"}
              onSelect={() => onChange({ sex: "male" })}
            />
            <ChoiceCard
              fullWidth
              icon={<FaVenus />}
              label="Девочка"
              selected={data.sex === "female"}
              onSelect={() => onChange({ sex: "female" })}
            />
          </SimpleGrid>
        </Box>
      </Stack>

      <PrimaryButton onClick={onNext}>
        <HStack gap={2}>
          <Text>Далее</Text>
          <LuArrowRight />
        </HStack>
      </PrimaryButton>
    </VStack>
  );
}
