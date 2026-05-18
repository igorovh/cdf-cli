export type PathEntry = {
  name: string;
  path: string;
  isFavorite: boolean;
};

export function isPathEntry(value: unknown): value is PathEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const entry = value as Partial<PathEntry>;

  return (
    typeof entry.name === "string" &&
    typeof entry.path === "string" &&
    typeof entry.isFavorite === "boolean"
  );
}
