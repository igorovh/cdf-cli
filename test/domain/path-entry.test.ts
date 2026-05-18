import { describe, expect, test } from "bun:test";
import { isPathEntry } from "../../src/domain/path-entry";

describe("isPathEntry", () => {
  test("returns true for a valid PathEntry", () => {
    expect(
      isPathEntry({ name: "My Project", path: "/home/user/project", isFavorite: false }),
    ).toBe(true);
  });

  test("returns true for a valid PathEntry with isFavorite true", () => {
    expect(
      isPathEntry({ name: "work", path: "/work", isFavorite: true }),
    ).toBe(true);
  });

  test("returns true for an entry with extra properties", () => {
    expect(
      isPathEntry({ name: "a", path: "/a", isFavorite: false, extra: 1 }),
    ).toBe(true);
  });

  test("returns true when name has leading/trailing whitespace but non-empty trimmed", () => {
    expect(
      isPathEntry({ name: "  hello  ", path: "/p", isFavorite: false }),
    ).toBe(true);
  });

  test("returns false for null", () => {
    expect(isPathEntry(null)).toBe(false);
  });

  test("returns false for undefined", () => {
    expect(isPathEntry(undefined)).toBe(false);
  });

  test("returns false for a string", () => {
    expect(isPathEntry("not an object")).toBe(false);
  });

  test("returns false for a number", () => {
    expect(isPathEntry(42)).toBe(false);
  });

  test("returns false for a boolean", () => {
    expect(isPathEntry(false)).toBe(false);
  });

  test("returns false for an array", () => {
    expect(isPathEntry([{ name: "a", path: "/a", isFavorite: false }])).toBe(false);
  });

  test("returns false when name is missing", () => {
    expect(isPathEntry({ path: "/p", isFavorite: false })).toBe(false);
  });

  test("returns false when path is missing", () => {
    expect(isPathEntry({ name: "n", isFavorite: false })).toBe(false);
  });

  test("returns false when isFavorite is missing", () => {
    expect(isPathEntry({ name: "n", path: "/p" })).toBe(false);
  });

  test("returns false when name is empty after trimming", () => {
    expect(isPathEntry({ name: "   ", path: "/p", isFavorite: false })).toBe(false);
  });

  test("returns false when path is empty after trimming", () => {
    expect(isPathEntry({ name: "n", path: "   ", isFavorite: false })).toBe(false);
  });

  test("returns false when isFavorite is a string instead of boolean", () => {
    expect(isPathEntry({ name: "n", path: "/p", isFavorite: "true" })).toBe(false);
  });

  test("returns false when isFavorite is a number instead of boolean", () => {
    expect(isPathEntry({ name: "n", path: "/p", isFavorite: 1 })).toBe(false);
  });

  test("returns false for an empty object", () => {
    expect(isPathEntry({})).toBe(false);
  });

  test("returns false when name is an empty string", () => {
    expect(isPathEntry({ name: "", path: "/p", isFavorite: false })).toBe(false);
  });
});
