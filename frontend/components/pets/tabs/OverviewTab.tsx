import { Grid, GridItem, Stack } from "@chakra-ui/react";
import { NotesSection } from "@/components/pets/overview/NotesSection";
import { OverviewSection } from "@/components/pets/overview/OverviewSection";
import { VaccinesSection } from "@/components/pets/overview/VaccinesSection";
import { VetSection } from "@/components/pets/overview/VetSection";
import type { TPet } from "@/store/pets";

type TOverviewTabProps = {
  pet: TPet;
  backendPetId?: string;
};

export function OverviewTab({ pet, backendPetId }: TOverviewTabProps) {
  return (
    <Grid templateColumns={["1fr", null, null, "2fr 1fr"]} gap="20px">
      <GridItem>
        <Stack gap="20px">
          <OverviewSection pet={pet} backendPetId={backendPetId} />
          <VaccinesSection backendPetId={backendPetId} />
        </Stack>
      </GridItem>

      <GridItem>
        <Stack gap="20px">
          <NotesSection notes={pet.notes} backendPetId={backendPetId} />
          <VetSection vet={pet.vet} backendPetId={backendPetId} />
        </Stack>
      </GridItem>
    </Grid>
  );
}
