import { Heading, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import Head from "next/head";
import { AppWrapper } from "@/components/layout/AppWrapper";
import { AddPetCard } from "@/components/pets/AddPetCard";
import { PetCard } from "@/components/pets/PetCard";
import { toPetViewModel } from "@/lib/petViewModel";
import { usePetsQuery } from "@/lib/petsApi";
import { useAuthSession } from "@/lib/session";
import { usePetsStore } from "@/store/pets";

export default function PetsPage() {
  const session = useAuthSession();
  const localPets = usePetsStore((s) => s.pets);
  const petsQuery = usePetsQuery();
  const pets = petsQuery.data?.items.map(toPetViewModel) ?? localPets;

  return (
    <>
      <Head>
        <title>Мои питомцы — Pawsport</title>
      </Head>
      <AppWrapper maxW="1440px">
        <Stack gap={["24px", "24px", "36px", "48px"]}>
          <Heading as="h1" size={["xl", "2xl", "3xl"]}>
            Мои питомцы
          </Heading>
          {session && petsQuery.isLoading ? (
            <Text color="fg.muted">Загружаем питомцев...</Text>
          ) : session && petsQuery.isError ? (
            <Text color="red.200">Не удалось загрузить питомцев.</Text>
          ) : (
            <SimpleGrid columns={[1, 2, null, 3]} gap="20px">
              {pets.map((pet) => (
                <PetCard key={pet.id} pet={pet} />
              ))}
              <AddPetCard />
            </SimpleGrid>
          )}
        </Stack>
      </AppWrapper>
    </>
  );
}
