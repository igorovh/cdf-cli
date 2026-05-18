import {mkdir, readFile, writeFile} from "node:fs/promises";

import {isPathEntry, type PathEntry} from "../domain/path-entry";
import {cdfConfigDirectory, pathsJsonPath} from "./config-paths";

export type LoadResult = {
  entries: PathEntry[];
  warning?: string;
};

export async function loadPathEntries(): Promise<LoadResult> {
  await mkdir(cdfConfigDirectory, {recursive: true});

  try {
    const content = await readFile(pathsJsonPath, "utf8");

    if (content.trim().length === 0) {
      return {entries: []};
    }

    const parsed = JSON.parse(content) as unknown;

    if (!Array.isArray(parsed)) {
      return {
        entries: [],
        warning: `${pathsJsonPath} does not contain an array. Starting with an empty list.`,
      };
    }

    const entries = parsed.filter(isPathEntry);

    return {
      entries,
      warning:
        entries.length === parsed.length
          ? undefined
          : `Skipped invalid entries from ${pathsJsonPath}.`,
    };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return {entries: []};
    }

    return {
      entries: [],
      warning: `Failed to read ${pathsJsonPath}: ${formatError(error)}`,
    };
  }
}

export async function savePathEntries(entries: PathEntry[]): Promise<void> {
  await mkdir(cdfConfigDirectory, {recursive: true});
  await writeFile(pathsJsonPath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
