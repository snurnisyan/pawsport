import { promises as fs } from "node:fs";
import path from "node:path";
import Handlebars from "handlebars";

import type { GotenbergAsset } from "./gotenbergClient";
import type { PetExportPdfReport } from "./petExportReport";

export interface RenderPetExportTemplateResult {
  html: string;
  assets: GotenbergAsset[];
}

export interface RenderPetExportTemplateDependencies {
  templateRoot?: string;
}

const DEFAULT_TEMPLATE_ROOT = path.resolve(__dirname, "../../templates/pet-export");
const TEMPLATE_FILE = "index.html.hbs";
const ASSET_DIRS = ["assets", "fonts"] as const;

const collectFiles = async (
  absoluteDir: string,
  relativeDir: string,
  output: GotenbergAsset[]
): Promise<void> => {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(absoluteDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw error;
  }

  for (const entry of entries) {
    const absolutePath = path.join(absoluteDir, entry.name);
    const relativePath = path.posix.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(absolutePath, relativePath, output);
      continue;
    }
    if (!entry.isFile() || entry.name === ".gitkeep") {
      continue;
    }
    output.push({
      path: relativePath,
      content: await fs.readFile(absolutePath)
    });
  }
};

export const renderPetExportTemplate = async (
  report: PetExportPdfReport,
  dependencies: RenderPetExportTemplateDependencies = {}
): Promise<RenderPetExportTemplateResult> => {
  const templateRoot = dependencies.templateRoot ?? DEFAULT_TEMPLATE_ROOT;
  const templateSource = await fs.readFile(path.join(templateRoot, TEMPLATE_FILE), "utf8");
  const template = Handlebars.compile(templateSource, { noEscape: false });
  const html = template({
    report,
    profile: report.profile,
    events: report.events,
    files: report.files,
    reminders: report.reminders
  });

  const assets: GotenbergAsset[] = [];
  for (const dirname of ASSET_DIRS) {
    await collectFiles(path.join(templateRoot, dirname), dirname, assets);
  }

  return { html, assets };
};
