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

test("pet export template shows event file chips without rendering the files section", async () => {
  const { html } = await renderPetExportTemplate({
    exportId: "export-template-event-files",
    ownerId: "owner",
    petId: "pet",
    generatedAt: "2026-05-14T10:00:00.000Z",
    sections: ["events"],
    events: [
      {
        id: "event-1",
        type: "vaccine",
        title: "Rabies booster",
        eventDate: "2026-01-10T00:00:00.000Z",
        fileIds: ["file-1"]
      }
    ],
    files: [
      {
        id: "file-1",
        eventId: "event-1",
        originalName: "rabies-certificate.pdf",
        mimeType: "application/pdf",
        sizeBytes: 840_000,
        uploadedAt: "2026-01-11T00:00:00.000Z",
        downloadUrl: "https://download.example/rabies-certificate.pdf"
      }
    ]
  });

  assert.match(html, /class="file-chip" href="https:\/\/download\.example\/rabies-certificate\.pdf"/);
  assert.doesNotMatch(html, /<h2 class="section-title">Документы<\/h2>/);
});

test("pet export template renders unlinked files in the documents section", async () => {
  const { html } = await renderPetExportTemplate({
    exportId: "export-template-unlinked-files",
    ownerId: "owner",
    petId: "pet",
    generatedAt: "2026-05-14T10:00:00.000Z",
    sections: ["events"],
    events: [
      {
        id: "event-1",
        type: "vaccine",
        title: "Rabies booster",
        eventDate: "2026-01-10T00:00:00.000Z",
        fileIds: ["file-1"]
      }
    ],
    files: [
      {
        id: "file-1",
        eventId: "event-1",
        originalName: "rabies-certificate.pdf",
        mimeType: "application/pdf",
        sizeBytes: 840_000,
        uploadedAt: "2026-01-11T00:00:00.000Z",
        downloadUrl: "https://download.example/rabies-certificate.pdf"
      },
      {
        id: "file-2",
        originalName: "insurance-policy.pdf",
        mimeType: "application/pdf",
        sizeBytes: 420_000,
        uploadedAt: "2026-01-12T00:00:00.000Z",
        downloadUrl: "https://download.example/insurance-policy.pdf"
      }
    ]
  });

  assert.match(html, /<h2 class="section-title">Документы<\/h2>/);
  assert.match(html, /Файлы: <b>1<\/b>/);
  assert.match(html, /<td><a href="https:\/\/download\.example\/insurance-policy\.pdf">insurance-policy\.pdf<\/a><\/td>/);
  assert.doesNotMatch(
    html,
    /<td><a href="https:\/\/download\.example\/rabies-certificate\.pdf">rabies-certificate\.pdf<\/a><\/td>/
  );
  assert.match(html, /class="file-chip" href="https:\/\/download\.example\/rabies-certificate\.pdf"/);
});

test("pet export template renders user-facing labels in Russian", async () => {
  const { html } = await renderPetExportTemplate({
    exportId: "export-template-russian",
    ownerId: "owner",
    petId: "pet",
    generatedAt: "2026-05-14T10:00:00.000Z",
    period: { from: "2026-01-01", to: "2026-05-14" },
    sections: ["profile", "events", "files", "reminders"],
    profile: {
      id: "pet",
      name: "Miso",
      species: "cat",
      sex: "female",
      birthDate: "2022-03-02",
      weight: 4.2,
      microchipNumber: "123456789012345",
      notes: ["Не любит переноску"]
    },
    events: [
      {
        id: "event-1",
        type: "lab",
        title: "Blood test",
        eventDate: "2026-01-10T00:00:00.000Z",
        recurrence: { frequency: "weekly", interval: 2 },
        reminderOffset: "week",
        fileIds: ["file-1"]
      }
    ],
    files: [
      {
        id: "file-1",
        eventId: "event-1",
        originalName: "blood-test.pdf",
        mimeType: "application/pdf",
        sizeBytes: 840_000,
        uploadedAt: "2026-01-11T00:00:00.000Z",
        downloadUrl: "https://download.example/blood-test.pdf"
      }
    ],
    reminders: [
      {
        id: "reminder-1",
        eventId: "event-1",
        channel: "email",
        dueAt: "2026-01-10T00:00:00.000Z",
        sendAt: "2026-01-03T00:00:00.000Z",
        offset: "week",
        status: "pending"
      }
    ]
  });

  assert.match(html, /<html lang="ru">/);
  assert.match(html, /Медицинский отчет/);
  assert.match(html, /Период/);
  assert.match(html, /Заметки владельца/);
  assert.match(html, /История ухода/);
  assert.match(html, /Анализы и обследования/);
  assert.match(html, /Девочка/);
  assert.match(html, /Дата рождения:/);
  assert.match(html, /Микрочип:/);
  assert.match(html, /Вес: 4\.2 кг/);
  assert.match(html, /повторяется каждые 2 недели/);
  assert.match(html, /Документы/);
  assert.match(html, /Загружен/);
  assert.match(html, /КБ/);
  assert.doesNotMatch(html, /напоминание за неделю|Напоминание: email|reminder-chip/);
  assert.doesNotMatch(html, /Pet report|Generated|Owner notes|History of care|Uploaded|Report ID/);
});
