import assert from "node:assert/strict";
import test from "node:test";

import { renderPetExportTemplate } from "../src/services/petExportTemplate";
import type { PdfEvent } from "../src/services/petExportReport";

test("pet export template uses matching event type colors and icons", async () => {
  const types = ["vaccine", "treatment", "visit", "operation", "lab", "other"] as const;
  const events: PdfEvent[] = types.map((type, index) => ({
    id: `event-${type}`,
    type,
    title: `Event ${index + 1}`,
    eventDate: "2026-01-10T00:00:00.000Z",
    fileIds: []
  }));

  const { html } = await renderPetExportTemplate({
    exportId: "export-template-icons",
    ownerId: "owner",
    petId: "pet",
    generatedAt: "2026-05-14T10:00:00.000Z",
    sections: ["events"],
    events
  });

  for (const color of ["#c084fc", "#34d399", "#60a5fa", "#fb923c", "#ef96d6", "#64748b"]) {
    assert.match(html, new RegExp(color, "i"));
  }
  for (const iconPath of [
    "M19 9 8.7 19.3",
    "M12 20c-3.3 0-6-2.7-6-6",
    "M15 2H6a2 2 0 0 0-2 2",
    "M3.22 12H9.5l.5-1",
    "M12 22a7 7 0 0 0 7-7",
    'circle cx="19" cy="12" r="1"'
  ]) {
    assert.match(html, new RegExp(iconPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
