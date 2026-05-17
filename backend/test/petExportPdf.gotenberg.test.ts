import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { renderHtmlToPdf } from "../src/services/gotenbergClient";
import { renderPetExportTemplate } from "../src/services/petExportTemplate";
import type { PdfEvent, PdfFileMetadata } from "../src/services/petExportReport";

const enabled = process.env.GOTENBERG_INTEGRATION === "1";
const gotenbergUrl = process.env.GOTENBERG_URL ?? "http://localhost:3001";
const pdfArtifactPath = process.env.PET_EXPORT_PDF_ARTIFACT;

const countPdfPages = (pdf: Buffer): number => {
  const text = pdf.toString("latin1");
  return (text.match(/\/Type\s*\/Page\b/g) ?? []).length;
};

test(
  "pet export renders many timeline events through Gotenberg without collapsing file links",
  { skip: enabled ? false : "set GOTENBERG_INTEGRATION=1 and run docker compose gotenberg" },
  async () => {
    const events: PdfEvent[] = [];
    const files: PdfFileMetadata[] = [];

    for (let index = 0; index < 72; index += 1) {
      const eventId = `event-${index}`;
      const fileId = `file-${index}`;
      const day = String((index % 27) + 1).padStart(2, "0");
      const month = String((index % 12) + 1).padStart(2, "0");
      const title = `Timeline event ${index + 1}`;

      events.push({
        id: eventId,
        type: index % 3 === 0 ? "vaccine" : index % 3 === 1 ? "visit" : "treatment",
        title,
        eventDate: `2025-${month}-${day}T00:00:00.000Z`,
        clinicName: "City Vet Clinic",
        comment: "Compact event body used to verify A4 pagination with avoid-page cards.",
        fileIds: [fileId]
      });

      files.push({
        id: fileId,
        eventId,
        originalName: `document-${index + 1}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 800_000 + index,
        uploadedAt: `2025-${month}-${day}T12:00:00.000Z`,
        eventTitle: title,
        downloadUrl: `https://download.example/documents/${index + 1}.pdf`
      });
    }

    const { html, assets } = await renderPetExportTemplate({
      exportId: "export-gotenberg-pagination",
      ownerId: "owner",
      petId: "pet",
      generatedAt: "2026-05-14T10:00:00.000Z",
      period: { from: "2025-01-01", to: "2025-12-31" },
      sections: ["profile", "events", "files"],
      profile: {
        id: "pet",
        name: "Baron",
        species: "dog",
        breed: "Labrador Retriever",
        birthDate: "2021-04-12",
        sex: "male",
        weight: 28.5,
        microchipNumber: "123456789012345",
        tags: ["active", "traveler"],
        notes: ["Owner note kept intentionally short for the integration fixture."]
      },
      events,
      files
    });

    const pdf = await renderHtmlToPdf({ html, assets }, { gotenbergUrl, timeoutMs: 60_000 });
    if (pdfArtifactPath) {
      await mkdir(path.dirname(pdfArtifactPath), { recursive: true });
      await writeFile(pdfArtifactPath, pdf);
    }
    const pdfText = pdf.toString("latin1");

    assert.equal(pdf.subarray(0, 5).toString("utf8"), "%PDF-");
    assert.ok(pdf.length > 10_000);
    assert.ok(countPdfPages(pdf) > 1);
    assert.match(pdfText, /https:\/\/download\.example\/documents\/1\.pdf/);
    assert.match(pdfText, /https:\/\/download\.example\/documents\/72\.pdf/);
  }
);
