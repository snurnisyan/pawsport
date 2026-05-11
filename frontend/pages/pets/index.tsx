import { Heading, SimpleGrid, Stack } from "@chakra-ui/react";
import Head from "next/head";
import { AppWrapper } from "@/components/layout/AppWrapper";
import { AddPetCard } from "@/components/pets/AddPetCard";
import { PetCard } from "@/components/pets/PetCard";
import { usePetsStore } from "@/store/pets";

export default function PetsPage() {
  const pets = usePetsStore((s) => s.pets);

  return (
    <>
      <Head>
        <title>Мои питомцы — PawsPort</title>
      </Head>
      <AppWrapper>
        <Stack gap={6}>
          <Heading as="h1" size={{ base: "xl", md: "2xl" }}>
            Мои питомцы
          </Heading>
          <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={5}>
            {pets.map((pet) => (
              <PetCard key={pet.id} pet={pet} />
            ))}
            <AddPetCard />
          </SimpleGrid>
        </Stack>
      </AppWrapper>
    </>
  );
}
