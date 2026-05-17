import { useEffect, useRef, useState } from "react";
import { Box, Icon, Image, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { LuCamera, LuEllipsis, LuSearch } from "react-icons/lu";
import { FaMars, FaVenus } from "react-icons/fa6";
import { ChoiceCard } from "@/components/ui/ChoiceCard";
import { Pressable } from "@/components/ui/Pressable";
import { TextField } from "@/components/ui/TextField";
import DogIcon from "@/icons/dog-icon.svg";
import CatIcon from "@/icons/cat.svg";

export type TPetSpecies = "dog" | "cat" | "other";
export type TPetSex = "male" | "female";

export type TPetFormData = {
  name: string;
  species: TPetSpecies | null;
  breed: string;
  sex: TPetSex | null;
  photo: File | null;
};

type TPetFormProps = {
  data: TPetFormData;
  onChange: (patch: Partial<TPetFormData>) => void;
};

export function PetForm({ data, onChange }: TPetFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!data.photo) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(data.photo);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [data.photo]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    onChange({ photo: file });
    e.target.value = "";
  };

  return (
    <Stack gap="24px">
      <Stack gap="12px" align="center">
        <Pressable
          type="button"
          onClick={() => fileInputRef.current?.click()}
          w="120px"
          h="120px"
          rounded="full"
          borderWidth="2px"
          borderStyle={previewUrl ? "solid" : "dashed"}
          borderColor={previewUrl ? "border.subtle" : "border.default"}
          color="fg.muted"
          display="flex"
          alignItems="center"
          justifyContent="center"
          bg="transparent"
          cursor="pointer"
          overflow="hidden"
          _hover={{ borderColor: "primary.500", color: "primary.400" }}
          transition="all 0.15s"
        >
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt="Фото питомца"
              w="full"
              h="full"
              objectFit="cover"
            />
          ) : (
            <Icon boxSize="32px">
              <LuCamera />
            </Icon>
          )}
        </Pressable>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        <Text
          fontSize="12px"
          letterSpacing="0.12em"
          textTransform="uppercase"
          color="fg.muted"
        >
          {previewUrl ? "Нажмите, чтобы изменить" : "Загрузите фото (необязательно)"}
        </Text>
      </Stack>

      <Stack gap="20px">
        <TextField
          label="Имя"
          placeholder="Луна"
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />

        <Box>
          <Text
            fontSize="12px"
            fontWeight={600}
            color="fg.muted"
            textTransform="uppercase"
            letterSpacing="0.08em"
            mb="8px"
          >
            Вид
          </Text>
          <SimpleGrid columns={3} gap="12px">
            <ChoiceCard
              fullWidth
              icon={<DogIcon />}
              label="Собака"
              selected={data.species === "dog"}
              onSelect={() => onChange({ species: "dog" })}
            />
            <ChoiceCard
              fullWidth
              icon={<CatIcon />}
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
          value={data.breed}
          onChange={(e) => onChange({ breed: e.target.value })}
        />

        <Box>
          <Text
            fontSize="12px"
            fontWeight={600}
            color="fg.muted"
            textTransform="uppercase"
            letterSpacing="0.08em"
            mb="8px"
          >
            Пол (необязательно)
          </Text>
          <SimpleGrid columns={2} gap="12px">
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
    </Stack>
  );
}
