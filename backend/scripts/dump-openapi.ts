import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import "../src/routes";
import { createOpenApiDocument } from "../src/docs/openapi";

const outputPath = resolve(process.cwd(), process.argv[2] ?? "openapi.json");

writeFileSync(outputPath, `${JSON.stringify(createOpenApiDocument(), null, 2)}\n`);
process.stdout.write(`OpenAPI spec written to ${outputPath}\n`);
