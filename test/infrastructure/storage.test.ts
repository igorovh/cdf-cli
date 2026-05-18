import { afterAll, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmpDir = mkdtempSync(join(tmpdir(), "cdf-test-storage-"));
const configDir = join(tmpDir, ".config", "cdf");
const pathsJson = join(configDir, "paths.json");

mock.module("../../src/infrastructure/config-paths", () => ({
  cdfConfigDirectory: configDir,
  pathsJsonPath: pathsJson,
}));

const { loadPathEntries, savePathEntries } = await import("../../src/infrastructure/storage");

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("loadPathEntries", () => {
  test("returns ok with empty entries when file does not exist", async () => {
    const result = await loadPathEntries();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entries).toEqual([]);
    }
  });

  test("returns ok with empty entries when file is empty", async () => {
    writeFileSync(pathsJson, "", "utf8");
    const result = await loadPathEntries();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entries).toEqual([]);
    }
  });

  test("returns ok with empty entries when file is whitespace only", async () => {
    writeFileSync(pathsJson, "   \n  ", "utf8");
    const result = await loadPathEntries();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entries).toEqual([]);
    }
  });

  test("returns ok with parsed entries for valid JSON", async () => {
    const entries = [
      { name: "Project A", path: "/home/a", isFavorite: true },
      { name: "Project B", path: "/home/b", isFavorite: false },
    ];
    writeFileSync(pathsJson, JSON.stringify(entries), "utf8");
    const result = await loadPathEntries();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entries).toEqual(entries);
    }
  });

  test("filters out invalid entries and returns warning", async () => {
    const mixed = [
      { name: "Valid", path: "/valid", isFavorite: false },
      { name: "", path: "/bad", isFavorite: false },
      { name: "No Path", path: "", isFavorite: true },
      "not an object",
      null,
    ];
    writeFileSync(pathsJson, JSON.stringify(mixed), "utf8");
    const result = await loadPathEntries();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]!.name).toBe("Valid");
      expect(result.warning).toBeDefined();
      expect(result.warning).toContain("Skipped invalid entries");
    }
  });

  test("returns no warning when all entries are valid", async () => {
    const entries = [
      { name: "Valid", path: "/valid", isFavorite: false },
    ];
    writeFileSync(pathsJson, JSON.stringify(entries), "utf8");
    const result = await loadPathEntries();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warning).toBeUndefined();
    }
  });

  test("returns error when JSON is not an array", async () => {
    writeFileSync(pathsJson, '{"name": "not an array"}', "utf8");
    const result = await loadPathEntries();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("does not contain an array");
    }
  });

  test("returns error for corrupt JSON", async () => {
    writeFileSync(pathsJson, "{ invalid json", "utf8");
    const result = await loadPathEntries();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Failed to read");
    }
  });
});

describe("savePathEntries", () => {
  test("saves entries and they can be loaded back (round-trip)", async () => {
    const entries = [
      { name: "Roundtrip", path: "/roundtrip", isFavorite: true },
    ];
    await savePathEntries(entries);
    const result = await loadPathEntries();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entries).toEqual(entries);
    }
  });

  test("overwrites existing entries", async () => {
    const firstEntries = [
      { name: "First", path: "/first", isFavorite: false },
    ];
    await savePathEntries(firstEntries);

    const secondEntries = [
      { name: "Second", path: "/second", isFavorite: true },
    ];
    await savePathEntries(secondEntries);

    const result = await loadPathEntries();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entries).toEqual(secondEntries);
    }
  });

  test("saves empty array", async () => {
    await savePathEntries([]);
    const result = await loadPathEntries();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entries).toEqual([]);
    }
  });

  test("saves multiple entries", async () => {
    const entries = [
      { name: "One", path: "/one", isFavorite: false },
      { name: "Two", path: "/two", isFavorite: true },
      { name: "Three", path: "/three", isFavorite: false },
    ];
    await savePathEntries(entries);
    const result = await loadPathEntries();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entries).toEqual(entries);
    }
  });
});
