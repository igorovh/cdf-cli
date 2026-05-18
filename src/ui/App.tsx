import React, {useEffect, useMemo, useState} from "react";
import {Box, Text, useApp, useInput, type Key} from "ink";

import type {PathEntry} from "../domain/path-entry";
import {hasDuplicateEntry, searchEntries, type SearchResult} from "../domain/path-search";
import {loadPathEntries, savePathEntries} from "../infrastructure/storage";
import {pathsJsonPath} from "../infrastructure/config-paths";

type Mode = "loading" | "list" | "form";
type FormKind = "add" | "edit";
type FormField = "name" | "path" | "favorite";

type FormState = {
  kind: FormKind;
  editIndex?: number;
  name: string;
  path: string;
  isFavorite: boolean;
  field: FormField;
};

type AppProps = {
  onSelect: (path: string) => void;
  onProfile?: (event: string) => void;
};

const addOptionLabel = "➕ Add current directory";
const ansiCodes = {
  cyan: "\u001B[36m",
  darkGray: "\u001B[90m",
  green: "\u001B[32m",
  red: "\u001B[31m",
  reset: "\u001B[0m",
  yellow: "\u001B[33m",
} as const;
type AnsiColor = Exclude<keyof typeof ansiCodes, "reset">;
const ansiColorsEnabled = process.argv.includes("--force-color") || (!process.argv.includes("--no-color") && !("NO_COLOR" in process.env));

export function App({onSelect, onProfile}: AppProps) {
  const {exit} = useApp();
  const [mode, setMode] = useState<Mode>("loading");
  const [entries, setEntries] = useState<PathEntry[]>([]);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [form, setForm] = useState<FormState | undefined>(undefined);
  const [warning, setWarning] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [idleDots, setIdleDots] = useState(0);

  const results = useMemo(() => searchEntries(entries, query), [entries, query]);
  const totalListItems = results.length + 1;

  useEffect(() => {
    let mounted = true;

    onProfile?.("storage load started");

    void loadPathEntries().then((result) => {
      if (!mounted) {
        return;
      }

      onProfile?.(`storage loaded (${result.entries.length} entries)`);
      setEntries(result.entries);
      setWarning(result.warning);

      if (result.entries.length === 0) {
        setForm(createAddForm());
        setMode("form");
      } else {
        setMode("list");
      }
    });

    return () => {
      mounted = false;
    };
  }, [onProfile]);

  useEffect(() => {
    setSelectedIndex((current) => clampIndex(current, totalListItems));
  }, [totalListItems]);

  useEffect(() => {
    if (mode !== "list" || query.length > 0) {
      setIdleDots(0);
      return;
    }

    const interval = setInterval(() => {
      setIdleDots((current) => (current + 1) % 4);
    }, 450);

    return () => {
      clearInterval(interval);
    };
  }, [mode, query]);

  useInput((input, key) => {
    setError(undefined);

    if (mode === "loading") {
      return;
    }

    if (key.escape) {
      if (mode === "form") {
        if (entries.length === 0) {
          exit();
          return;
        }

        setMode("list");
        setForm(undefined);
        return;
      }

      exit();
      return;
    }

    if (mode === "form") {
      handleFormInput(input, key);
      return;
    }

    handleListInput(input, key);
  });

  function handleListInput(input: string, key: Key): void {
    if (key.upArrow || input === "k") {
      setSelectedIndex((current) => (current <= 0 ? totalListItems - 1 : current - 1));
      return;
    }

    if (key.downArrow || input === "j") {
      setSelectedIndex((current) => (current + 1 >= totalListItems ? 0 : current + 1));
      return;
    }

    if (key.return) {
      if (selectedIndex >= results.length) {
        setForm(createAddForm());
        setMode("form");
        return;
      }

      const selected = results[selectedIndex];

      if (selected) {
        exit();
        onSelect(selected.entry.path);
      }

      return;
    }

    if (input === "e") {
      const selected = results[selectedIndex];

      if (selected) {
        setForm(createEditForm(selected));
        setMode("form");
      }

      return;
    }

    if (key.backspace || key.delete) {
      setQuery((current) => current.slice(0, -1));
      setSelectedIndex(0);
      return;
    }

    if (isTextInput(input)) {
      setQuery((current) => `${current}${input}`);
      setSelectedIndex(0);
    }
  }

  function handleFormInput(input: string, key: Key): void {
    if (!form) {
      return;
    }

    if (key.tab || key.downArrow) {
      setForm({...form, field: nextField(form.field)});
      return;
    }

    if (key.upArrow) {
      setForm({...form, field: previousField(form.field)});
      return;
    }

    if (key.return) {
      if (form.field !== "favorite") {
        setForm({...form, field: nextField(form.field)});
        return;
      }

      void saveForm(form);
      return;
    }

    if (form.field === "favorite") {
      if (key.leftArrow || key.rightArrow || input === "a" || input === "d") {
        setForm({...form, isFavorite: !form.isFavorite});
        return;
      }

      if (["t", "T", "y", "Y"].includes(input)) {
        setForm({...form, isFavorite: true});
      }

      if (["n", "N"].includes(input)) {
        setForm({...form, isFavorite: false});
      }

      if (input === " ") {
        setForm({...form, isFavorite: !form.isFavorite});
      }

      return;
    }

    if (key.backspace || key.delete) {
      setForm(updateFormText(form, (value) => value.slice(0, -1)));
      return;
    }

    if (isTextInput(input)) {
      setForm(updateFormText(form, (value) => `${value}${input}`));
    }
  }

  async function saveForm(currentForm: FormState): Promise<void> {
    const candidate: PathEntry = {
      name: currentForm.name.trim(),
      path: currentForm.path.trim(),
      isFavorite: currentForm.isFavorite,
    };

    if (candidate.name.length === 0) {
      setError("Name cannot be empty.");
      setForm({...currentForm, field: "name"});
      return;
    }

    if (candidate.path.length === 0) {
      setError("Path cannot be empty.");
      setForm({...currentForm, field: "path"});
      return;
    }

    const duplicate = hasDuplicateEntry(entries, candidate, currentForm.editIndex);
    const nextEntries = [...entries];

    if (currentForm.kind === "edit" && currentForm.editIndex !== undefined) {
      nextEntries[currentForm.editIndex] = candidate;
    } else {
      nextEntries.push(candidate);
    }

    try {
      await savePathEntries(nextEntries);
      setEntries(nextEntries);
      setQuery("");
      setSelectedIndex(0);
      setWarning(duplicate ? "Saved despite a duplicate name or path." : undefined);
      setForm(undefined);
      setMode("list");
    } catch (saveError) {
      setError(
        `Failed to save ${pathsJsonPath}: ${saveError instanceof Error ? saveError.message : String(saveError)}`,
      );
    }
  }

  if (mode === "loading") {
    return <Text>Loading cdf...</Text>;
  }

  if (mode === "form" && form) {
    const duplicate = hasDuplicateEntry(
      entries,
      {name: form.name, path: form.path, isFavorite: form.isFavorite},
      form.editIndex,
    );

    return (
      <Box flexDirection="column">
        <Text bold>{form.kind === "add" ? "Add current directory" : "Edit directory"}</Text>
        <Text>{paint("green", "Enter")} moves forward or saves on the favorite field. {paint("red", "Esc")} cancels.</Text>
        <FormLine active={form.field === "name"} label="name" value={form.name} />
        <FormLine active={form.field === "path"} label="path" value={form.path} color="darkGray" />
        <Text>
          {form.field === "favorite" ? "> " : "  "}favorite: {form.isFavorite ? "y" : "n"}
        </Text>
        {duplicate ? <Text color="yellow">Warning: this name or path already exists. You can still save it.</Text> : null}
        {warning ? <Text color="yellow">{warning}</Text> : null}
        {error ? <Text color="red">{error}</Text> : null}
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>cdf</Text>
      <Text>
        Search: {query.length > 0 ? paint("cyan", query) : paint("darkGray", ".".repeat(idleDots))}
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {results.map((result, index) => (
          <ListLine key={`${result.originalIndex}:${result.entry.name}:${result.entry.path}`} active={index === selectedIndex} result={result} />
        ))}
        <Text>
          {selectedIndex === results.length ? paint("cyan", "> ") : "  "}
          {selectedIndex === results.length ? paint("cyan", addOptionLabel) : addOptionLabel}
        </Text>
      </Box>
      {results.length === 0 ? <Text color="yellow">No matches.</Text> : null}
      {warning ? <Text color="yellow">{warning}</Text> : null}
      {error ? <Text color="red">{error}</Text> : null}
      <KeybindHelp />
    </Box>
  );
}

function ListLine({active, result}: {active: boolean; result: SearchResult}) {
  const marker = result.entry.isFavorite ? "★" : " ";

  return (
    <Text>
      {active ? paint("cyan", "> ") : "  "}
      {result.entry.isFavorite ? paint("yellow", marker) : marker}{" "}
      {active ? paint("cyan", result.entry.name) : result.entry.name}{" "}
      {paint("darkGray", result.entry.path)}
    </Text>
  );
}

function KeybindHelp() {
  return (
    <Box marginTop={1}>
      <Text>
        {paint("cyan", "↑/↓")} or {paint("cyan", "j/k")} selects, {paint("green", "Enter")} confirms, {paint("yellow", "e")} edits, {paint("red", "Esc")} exits.
      </Text>
    </Box>
  );
}

function FormLine({
  active,
  label,
  value,
  color,
}: {
  active: boolean;
  label: string;
  value: string;
  color?: AnsiColor;
}) {
  return (
    <Text>
      {active ? "> " : "  "}
      {label}: {color ? paint(color, value) : value}
    </Text>
  );
}

function paint(color: AnsiColor, text: string): string {
  if (!ansiColorsEnabled || text.length === 0) {
    return text;
  }

  return `${ansiCodes[color]}${text}${ansiCodes.reset}`;
}

function createAddForm(): FormState {
  return {
    kind: "add",
    name: "",
    path: process.cwd(),
    isFavorite: false,
    field: "name",
  };
}

function createEditForm(result: SearchResult): FormState {
  return {
    kind: "edit",
    editIndex: result.originalIndex,
    name: result.entry.name,
    path: result.entry.path,
    isFavorite: result.entry.isFavorite,
    field: "name",
  };
}

function updateFormText(form: FormState, update: (value: string) => string): FormState {
  if (form.field === "name") {
    return {...form, name: update(form.name)};
  }

  if (form.field === "path") {
    return {...form, path: update(form.path)};
  }

  return form;
}

function nextField(field: FormField): FormField {
  if (field === "name") {
    return "path";
  }

  if (field === "path") {
    return "favorite";
  }

  return "name";
}

function previousField(field: FormField): FormField {
  if (field === "favorite") {
    return "path";
  }

  if (field === "path") {
    return "name";
  }

  return "favorite";
}

function clampIndex(index: number, itemCount: number): number {
  if (itemCount <= 0) {
    return 0;
  }

  return Math.min(index, itemCount - 1);
}

function isTextInput(input: string): boolean {
  return input.length > 0 && !input.includes("\u001B") && !input.includes("\r") && !input.includes("\n");
}
