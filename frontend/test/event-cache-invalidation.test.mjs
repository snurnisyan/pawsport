import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

const invalidatesPetsList = (source) =>
  /\binvalidateQueries\s*\(\s*\{\s*queryKey:\s*petsQueryKey\s*\}/.test(source);

test("event create/update invalidates the pet list cache that owns expiredEvents", async () => {
  const eventDialog = await readSource("components/pets/events/EventDialog.tsx");
  const calendarPage = await readSource("pages/calendar/index.tsx");

  assert.ok(
    /\bpetsQueryKey\b/.test(eventDialog),
    "EventDialog create/update success must reference petsQueryKey"
  );
  assert.ok(
    invalidatesPetsList(eventDialog),
    "EventDialog create/update success must invalidate petsQueryKey because /pets expiredEvents depend on events"
  );
  assert.ok(
    /\bpetsQueryKey\b/.test(calendarPage),
    "Calendar create/update success must reference petsQueryKey"
  );
  assert.ok(
    invalidatesPetsList(calendarPage),
    "Calendar create/update success must invalidate petsQueryKey because /pets expiredEvents depend on events"
  );
});

test("event delete invalidates the pet list cache that owns expiredEvents", async () => {
  const eventsTab = await readSource("components/pets/tabs/EventsTab.tsx");

  assert.ok(
    /\bpetsQueryKey\b/.test(eventsTab),
    "EventsTab delete success must reference petsQueryKey"
  );
  assert.ok(
    invalidatesPetsList(eventsTab),
    "EventsTab delete success must invalidate petsQueryKey because deleting an event can change expiredEvents"
  );
});

test("expired-event quick add passes the backend pet id into EventDialog", async () => {
  const petCard = await readSource("components/pets/PetCard.tsx");

  assert.ok(
    /<EventDialog[\s\S]*?\bpetId=\{pet\.id\}/.test(petCard),
    "PetCard expired-event quick add must pass petId so saving creates a backend event"
  );
});
