import type {PathEntry} from "./path-entry";

export type SearchResult = {
  entry: PathEntry;
  originalIndex: number;
};

export function sortEntries(entries: PathEntry[]): SearchResult[] {
  return entries
    .map((entry, originalIndex) => ({entry, originalIndex}))
    .sort((left, right) => {
      if (left.entry.isFavorite !== right.entry.isFavorite) {
        return left.entry.isFavorite ? -1 : 1;
      }

      return left.entry.name.localeCompare(right.entry.name, undefined, {
        sensitivity: "base",
      });
    });
}

export function searchEntries(entries: PathEntry[], query: string): SearchResult[] {
  const sortedEntries = sortEntries(entries);
  const normalizedQuery = query.trim().toLowerCase();

  if (normalizedQuery.length === 0) {
    return sortedEntries;
  }

  const nameMatches: SearchResult[] = [];
  const pathMatches: SearchResult[] = [];

  for (const result of sortedEntries) {
    const name = result.entry.name.toLowerCase();
    const path = result.entry.path.toLowerCase();

    if (name.includes(normalizedQuery)) {
      nameMatches.push(result);
      continue;
    }

    if (path.includes(normalizedQuery)) {
      pathMatches.push(result);
    }
  }

  return [...nameMatches, ...pathMatches];
}

export function hasDuplicateEntry(
  entries: PathEntry[],
  candidate: PathEntry,
  ignoredIndex?: number,
): boolean {
  const normalizedName = candidate.name.trim().toLowerCase();
  const normalizedPath = candidate.path.trim().toLowerCase();

  return entries.some((entry, index) => {
    if (index === ignoredIndex) {
      return false;
    }

    return (
      entry.name.trim().toLowerCase() === normalizedName ||
      entry.path.trim().toLowerCase() === normalizedPath
    );
  });
}
