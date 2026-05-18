import { Stack, Text } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import Head from "next/head";
import { useRouter } from "next/router";
import { useMemo } from "react";
import { AppWrapper } from "@/components/layout/AppWrapper";
import { PetHero } from "@/components/pets/PetHero";
import { EventsTab } from "@/components/pets/tabs/EventsTab";
import { ExportTab } from "@/components/pets/tabs/ExportTab";
import { FilesTab } from "@/components/pets/tabs/FilesTab";
import { OverviewTab } from "@/components/pets/tabs/OverviewTab";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { ApiError } from "@/lib/api";
import { getPet, petQueryKey } from "@/lib/petsApi";
import { toPetViewModel } from "@/lib/petViewModel";
import { useAuthSession, useClientReady } from "@/lib/session";
import { usePetNavigationStore, type TPetPageTab } from "@/store/petNavigation";
import { usePetsStore } from "@/store/pets";

const TABS: { value: TPetPageTab; label: string }[] = [
  { value: "overview", label: "Общая информация" },
  { value: "events", label: "События" },
  { value: "files", label: "Файлы" },
  { value: "export", label: "Экспорт" },
];

export default function PetPage() {
  const router = useRouter();
  const clientReady = useClientReady();
  const session = useAuthSession();
  const id =
    router.isReady && typeof router.query.id === "string" ? router.query.id : "";
  const tab = usePetNavigationStore((s) => s.petTabs[id] ?? "overview");
  const setPetTab = usePetNavigationStore((s) => s.setPetTab);
  const pets = usePetsStore((s) => s.pets);
  const petQuery = useQuery({
    queryKey: petQueryKey(id),
    queryFn: () => getPet(id),
    enabled: router.isReady && Boolean(id) && Boolean(session?.accessToken),
  });
  const localPet = useMemo(() => pets.find((p) => p.id === id), [pets, id]);
  const pet = petQuery.data?.pet ? toPetViewModel(petQuery.data.pet) : localPet;

  if (!router.isReady || !clientReady) {
    return (
      <AppWrapper>
        <Text color="fg.muted">Загружаем карточку питомца...</Text>
      </AppWrapper>
    );
  }

  if (session?.accessToken && petQuery.isLoading) {
    return (
      <AppWrapper>
        <Text color="fg.muted">Загружаем карточку питомца...</Text>
      </AppWrapper>
    );
  }

  if (session?.accessToken && petQuery.isError) {
    const error = petQuery.error;
    const isNotFound =
      error instanceof ApiError &&
      (error.status === 404 || error.code === "PET_NOT_FOUND" || error.code === "INVALID_PET_ID");
    const isUnauthorized =
      error instanceof ApiError &&
      (error.status === 401 || error.code === "UNAUTHORIZED");

    return (
      <AppWrapper>
        <Stack gap="8px">
          <Text fontWeight={700} color={isNotFound ? "fg.default" : "red.200"}>
            {isNotFound
              ? "Питомец не найден"
              : isUnauthorized
                ? "Сессия истекла"
                : "Не удалось загрузить карточку питомца"}
          </Text>
          <Text color="fg.muted">
            {isNotFound
              ? "Возможно, карточка была удалена или у вас нет доступа."
              : isUnauthorized
                ? "Войдите снова, чтобы открыть карточку питомца."
                : error instanceof ApiError
                  ? error.message
                  : "Попробуйте обновить страницу."}
          </Text>
        </Stack>
      </AppWrapper>
    );
  }

  if (!pet) {
    return (
      <AppWrapper>
        <Stack gap="8px">
          <Text fontWeight={700}>Питомец не найден</Text>
          <Text color="fg.muted">
            Возможно, карточка была удалена или у вас нет доступа.
          </Text>
        </Stack>
      </AppWrapper>
    );
  }

  return (
    <>
      <Head>
        <title>{pet.name} — Pawsport</title>
      </Head>
      <AppWrapper>
        <Stack gap="24px">
          <PetHero pet={pet} />
          <SegmentedTabs
            tabs={TABS}
            value={tab}
            onChange={(value) => setPetTab(id, value as TPetPageTab)}
          />
          {tab === "overview" && (
            <OverviewTab
              pet={pet}
              backendPetId={petQuery.data?.pet.id}
              onPetDeleted={() => router.push("/pets")}
            />
          )}
          {tab === "events" && <EventsTab petId={petQuery.data?.pet.id} />}
          {tab === "files" && <FilesTab petId={petQuery.data?.pet.id} />}
          {tab === "export" && (
            <ExportTab
              petId={petQuery.data?.pet.id}
              petName={pet.name}
              usesBackend={Boolean(session?.accessToken && petQuery.data?.pet.id)}
            />
          )}
        </Stack>
      </AppWrapper>
    </>
  );
}
