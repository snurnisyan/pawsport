import { useEffect, useMemo, useState } from "react";
import { EVENT_TYPE_FILTER_OPTIONS } from "@/lib/eventTypes";
import type { TPetEventType } from "@/store/pets";

const ALL_EVENT_TYPES = EVENT_TYPE_FILTER_OPTIONS.map(
  (option) => option.value
) as TPetEventType[];

const sameValues = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value, idx) => value === b[idx]);

export function useCalendarFilters(petIds: string[]) {
  const [selectedEventTypes, setSelectedEventTypes] =
    useState<TPetEventType[]>(ALL_EVENT_TYPES);
  const [selectedPetIds, setSelectedPetIds] = useState<string[]>([]);
  const [petFilterTouched, setPetFilterTouched] = useState(false);

  const effectiveSelectedPetIds = useMemo(
    () => (petFilterTouched ? selectedPetIds : petIds),
    [petFilterTouched, petIds, selectedPetIds]
  );

  useEffect(() => {
    if (!petFilterTouched) return;

    const timer = window.setTimeout(() => {
      setSelectedPetIds((current) => {
        const valid = current.filter((id) => petIds.includes(id));
        return sameValues(current, valid) ? current : valid;
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [petFilterTouched, petIds]);

  return {
    allEventTypes: ALL_EVENT_TYPES,
    selectedEventTypes,
    setSelectedEventTypes,
    effectiveSelectedPetIds,
    selectPetIds: (ids: string[]) => {
      setPetFilterTouched(true);
      setSelectedPetIds(ids);
    },
  };
}
