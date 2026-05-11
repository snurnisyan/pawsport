import { Stack, Text } from "@chakra-ui/react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import { AppWrapper } from "@/components/layout/AppWrapper";
import { PetHero } from "@/components/pets/PetHero";
import { EventsTab } from "@/components/pets/tabs/EventsTab";
import { ExportTab } from "@/components/pets/tabs/ExportTab";
import { FilesTab } from "@/components/pets/tabs/FilesTab";
import { OverviewTab } from "@/components/pets/tabs/OverviewTab";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { usePetsStore } from "@/store/pets";

const TABS = [
  { value: "overview", label: "Общая информация" },
  { value: "events", label: "События" },
  { value: "files", label: "Файлы" },
  { value: "export", label: "Экспорт" },
];

export default function PetPage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const pets = usePetsStore((s) => s.pets);
  const allEvents = usePetsStore((s) => s.events);
  const pet = useMemo(() => pets.find((p) => p.id === id), [pets, id]);
  const events = useMemo(
    () => allEvents.filter((e) => e.petId === id),
    [allEvents, id]
  );
  const [tab, setTab] = useState("overview");

  if (!router.isReady) {
    return <AppWrapper><Text color="fg.muted">Загрузка...</Text></AppWrapper>;
  }

  if (!pet) {
    return (
      <AppWrapper>
        <Text color="fg.muted">Питомец не найден</Text>
      </AppWrapper>
    );
  }

  return (
    <>
      <Head>
        <title>{pet.name} — PawsPort</title>
      </Head>
      <AppWrapper>
        <Stack gap="24px">
          <PetHero pet={pet} />
          <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} />
          {tab === "overview" && <OverviewTab pet={pet} />}
          {tab === "events" && <EventsTab events={events} />}
          {tab === "files" && <FilesTab />}
          {tab === "export" && <ExportTab />}
        </Stack>
      </AppWrapper>
    </>
  );
}
