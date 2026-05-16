import { Grid, GridItem, Stack } from "@chakra-ui/react";
import { NotesSection } from "@/components/pets/overview/NotesSection";
import { OverviewSection } from "@/components/pets/overview/OverviewSection";
import { VaccinesSection } from "@/components/pets/overview/VaccinesSection";
import { VetSection } from "@/components/pets/overview/VetSection";
import type { TPet } from "@/store/pets";

type TOverviewTabProps = {
  pet: TPet;
};

export function OverviewTab({ pet }: TOverviewTabProps) {
  return (
    <Grid templateColumns={["1fr", null, null, "2fr 1fr"]} gap="20px">
      <GridItem>
        <Stack gap="20px">
          <OverviewSection pet={pet} />
          <VaccinesSection />
        </Stack>
      </GridItem>

      <GridItem>
        <Stack gap="20px">
          <NotesSection notes={pet.notes} />
          {pet.vet && <VetSection vet={pet.vet} />}
        </Stack>
      </GridItem>
    </Grid>
  );
}
