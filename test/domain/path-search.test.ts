import { describe, expect, test } from "bun:test";
import type { PathEntry } from "../../src/domain/path-entry";
import { hasDuplicateEntry, searchEntries, sortEntries } from "../../src/domain/path-search";

function entry(name: string, path: string, isFavorite = false): PathEntry {
  return { name, path, isFavorite };
}

describe("sortEntries", () => {
  test("returns empty array for empty input", () => {
    expect(sortEntries([])).toEqual([]);
  });

  test("returns single entry with originalIndex 0", () => {
    const result = sortEntries([entry("a", "/a")]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ entry: entry("a", "/a"), originalIndex: 0 });
  });

  test("sorts favorites before non-favorites", () => {
    const entries = [
      entry("b", "/b", false),
      entry("a", "/a", true),
    ];
    const result = sortEntries(entries);
    expect(result.map((r) => r.entry.isFavorite)).toEqual([true, false]);
  });

  test("sorts favorites alphabetically by name", () => {
    const entries = [
      entry("c", "/c", true),
      entry("a", "/a", true),
      entry("b", "/b", true),
    ];
    const result = sortEntries(entries);
    expect(result.map((r) => r.entry.name)).toEqual(["a", "b", "c"]);
  });

  test("sorts non-favorites alphabetically by name", () => {
    const entries = [
      entry("z", "/z"),
      entry("m", "/m"),
      entry("a", "/a"),
    ];
    const result = sortEntries(entries);
    expect(result.map((r) => r.entry.name)).toEqual(["a", "m", "z"]);
  });

  test("sorts case-insensitively", () => {
    const entries = [
      entry("B", "/b"),
      entry("a", "/a"),
      entry("C", "/c"),
    ];
    const result = sortEntries(entries);
    expect(result.map((r) => r.entry.name)).toEqual(["a", "B", "C"]);
  });

  test("preserves originalIndex through mapping", () => {
    const entries = [
      entry("b", "/b"),
      entry("a", "/a"),
      entry("c", "/c"),
    ];
    const result = sortEntries(entries);
    const indices = result.map((r) => r.originalIndex).sort((a, b) => a - b);
    expect(indices).toEqual([0, 1, 2]);
  });

  test("sorts mixed: favorites first (alphabetical), then non-favorites (alphabetical)", () => {
    const entries = [
      entry("d", "/d", false),
      entry("b", "/b", true),
      entry("c", "/c", false),
      entry("a", "/a", true),
    ];
    const result = sortEntries(entries);
    expect(result.map((r) => r.entry.name)).toEqual(["a", "b", "c", "d"]);
    expect(result.map((r) => r.entry.isFavorite)).toEqual([true, true, false, false]);
  });
});

describe("searchEntries", () => {
  const entries: PathEntry[] = [
    entry("My Project", "/home/user/projects/my-project"),
    entry("Work Docs", "/home/user/work"),
    entry("Downloads", "/home/user/downloads"),
    entry("Config", "/etc/config"),
  ];

  test("returns all entries sorted for empty query", () => {
    const result = searchEntries(entries, "");
    expect(result).toHaveLength(4);
  });

  test("returns all entries sorted for whitespace-only query", () => {
    const result = searchEntries(entries, "   ");
    expect(result).toHaveLength(4);
  });

  test("matches by name (case-insensitive)", () => {
    const result = searchEntries(entries, "project");
    expect(result).toHaveLength(1);
    expect(result[0]!.entry.name).toBe("My Project");
  });

  test("matches by name with different case", () => {
    const result = searchEntries(entries, "MY PROJECT");
    expect(result).toHaveLength(1);
    expect(result[0]!.entry.name).toBe("My Project");
  });

  test("matches by path when name does not match", () => {
    const result = searchEntries(entries, "etc");
    expect(result).toHaveLength(1);
    expect(result[0]!.entry.name).toBe("Config");
  });

  test("returns name matches before path matches", () => {
    const entriesWithOverlap: PathEntry[] = [
      entry("downloads", "/home/user/my-files"),
      entry("files", "/home/user/downloads"),
    ];
    const result = searchEntries(entriesWithOverlap, "downloads");
    expect(result).toHaveLength(2);
    expect(result[0]!.entry.name).toBe("downloads");
    expect(result[1]!.entry.name).toBe("files");
  });

  test("returns empty array when nothing matches", () => {
    const result = searchEntries(entries, "nonexistent");
    expect(result).toEqual([]);
  });

  test("matches by partial name", () => {
    const result = searchEntries(entries, "work");
    expect(result).toHaveLength(1);
    expect(result[0]!.entry.name).toBe("Work Docs");
  });

  test("matches multiple entries by common substring", () => {
    const result = searchEntries(entries, "do");
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.entry.name).sort()).toEqual(["Downloads", "Work Docs"]);
  });

  test("trims the query before searching", () => {
    const result = searchEntries(entries, "  project  ");
    expect(result).toHaveLength(1);
    expect(result[0]!.entry.name).toBe("My Project");
  });
});

describe("hasDuplicateEntry", () => {
  const entries: PathEntry[] = [
    entry("Project Alpha", "/home/alpha"),
    entry("Project Beta", "/home/beta"),
    entry("Project Gamma", "/home/gamma"),
  ];

  test("returns true for duplicate name", () => {
    expect(hasDuplicateEntry(entries, entry("Project Alpha", "/new/path"))).toBe(true);
  });

  test("returns true for duplicate name (case-insensitive)", () => {
    expect(hasDuplicateEntry(entries, entry("project alpha", "/new/path"))).toBe(true);
  });

  test("returns true for duplicate path", () => {
    expect(hasDuplicateEntry(entries, entry("new name", "/home/beta"))).toBe(true);
  });

  test("returns true for duplicate path (case-insensitive)", () => {
    expect(hasDuplicateEntry(entries, entry("new name", "/HOME/BETA"))).toBe(true);
  });

  test("returns false when neither name nor path is duplicate", () => {
    expect(hasDuplicateEntry(entries, entry("New One", "/new/path"))).toBe(false);
  });

  test("returns false when editing the matched entry (ignoredIndex)", () => {
    expect(hasDuplicateEntry(entries, entry("Project Alpha", "/home/alpha"), 0)).toBe(false);
  });

  test("returns true when editing one entry but duplicating another", () => {
    expect(hasDuplicateEntry(entries, entry("Project Alpha", "/home/alpha"), 1)).toBe(true);
  });

  test("trims whitespace in comparison", () => {
    expect(hasDuplicateEntry(entries, entry("  Project Beta  ", "/home/beta"))).toBe(true);
  });

  test("returns false for empty entries array", () => {
    expect(hasDuplicateEntry([], entry("a", "/a"))).toBe(false);
  });

  test("returns true for duplicate with extra whitespace in stored entry", () => {
    const paddedEntries: PathEntry[] = [entry("  hello  ", "/path")];
    expect(hasDuplicateEntry(paddedEntries, entry("hello", "/path"))).toBe(true);
  });
});
