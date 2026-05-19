import { useRouter } from "next/router";
import { usePetNavigationStore } from "@/store/petNavigation";

export function useOpenReminderPet(onClose: () => void) {
  const router = useRouter();
  const setPetTab = usePetNavigationStore((s) => s.setPetTab);
  return (petId: string) => {
    setPetTab(petId, "events");
    onClose();
    void router.push(`/pets/${petId}`);
  };
}
