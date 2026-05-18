import React, {useState} from "react";
import {Box, Text, useApp, useInput} from "ink";

import {
  bashOrZshBlock,
  installShellWrappers,
  nushellBlock,
  type SetupResult,
  type ShellConfigTarget,
} from "../infrastructure/shell-setup";

type SetupMode = "select" | "installing" | "done";

type SetupAppProps = {
  targets: ShellConfigTarget[];
  cdfRunPath?: string;
};

export function SetupApp({targets, cdfRunPath}: SetupAppProps) {
  const {exit} = useApp();
  const [mode, setMode] = useState<SetupMode>("select");
  const [cursorIndex, setCursorIndex] = useState(0);
  const [selectedPaths, setSelectedPaths] = useState(() => new Set(targets.map((target) => target.path)));
  const [results, setResults] = useState<SetupResult[]>([]);

  useInput((input, key) => {
    if (key.escape) {
      exit();
      return;
    }

    if (targets.length === 0) {
      if (key.return) {
        exit();
      }

      return;
    }

    if (mode === "done") {
      if (key.return) {
        exit();
      }

      return;
    }

    if (mode === "installing") {
      return;
    }

    if (key.upArrow || input === "k") {
      setCursorIndex((current) => (current <= 0 ? targets.length - 1 : current - 1));
      return;
    }

    if (key.downArrow || input === "j") {
      setCursorIndex((current) => (current + 1 >= targets.length ? 0 : current + 1));
      return;
    }

    if (input === " ") {
      const target = targets[cursorIndex];

      if (!target) {
        return;
      }

      setSelectedPaths((current) => {
        const next = new Set(current);

        if (next.has(target.path)) {
          next.delete(target.path);
        } else {
          next.add(target.path);
        }

        return next;
      });
      return;
    }

    if (key.return) {
      void installSelectedTargets();
    }
  });

  async function installSelectedTargets(): Promise<void> {
    const selectedTargets = targets.filter((target) => selectedPaths.has(target.path));

    if (selectedTargets.length === 0) {
      setResults([]);
      setMode("done");
      return;
    }

    setMode("installing");
    setResults(await installShellWrappers(selectedTargets));
    setMode("done");
  }

  if (targets.length === 0) {
    const bashOrZshSnippet = bashOrZshBlock();
    const nushellSnippet = nushellBlock();

    return (
      <Box flexDirection="column">
        <Text bold>cdf-setup</Text>
        {cdfRunPath ? (
          <Text color="green">Found cdf-run: {cdfRunPath}</Text>
        ) : (
          <Text color="yellow">cdf-run was not found on PATH. Run `bun run install-global`, open a new terminal, then run `cdf-setup` again.</Text>
        )}
        <Text color="yellow">No existing Bash, Zsh, or Nushell config files were found.</Text>
        <Text>No config files were created automatically. Add the wrapper manually if you want to use it.</Text>
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Bash/Zsh</Text>
          {bashOrZshSnippet.split("\n").map((line, index) => (
            <Text key={`bash-zsh-${index}`}>{line}</Text>
          ))}
        </Box>
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Nushell</Text>
          {nushellSnippet.split("\n").map((line, index) => (
            <Text key={`nushell-${index}`}>{line}</Text>
          ))}
        </Box>
        <Text color="gray">Enter or Esc exits.</Text>
      </Box>
    );
  }

  if (mode === "installing") {
    return (
      <Box flexDirection="column">
        <Text bold>cdf-setup</Text>
        {cdfRunPath ? (
          <Text color="green">Found cdf-run: {cdfRunPath}</Text>
        ) : (
          <Text color="yellow">cdf-run was not found on PATH. The installed wrapper will not work until cdf-run is globally available.</Text>
        )}
        <Text>Installing wrappers...</Text>
      </Box>
    );
  }

  if (mode === "done") {
    return (
      <Box flexDirection="column">
        <Text bold>cdf-setup complete</Text>
        {cdfRunPath ? (
          <Text color="green">Found cdf-run: {cdfRunPath}</Text>
        ) : (
          <Text color="yellow">cdf-run was not found on PATH. Run `bun run install-global`, open a new terminal, then run `cdf-setup` again.</Text>
        )}
        {results.length === 0 ? <Text color="yellow">Nothing selected. No configuration was changed.</Text> : null}
        {results.map((result) => (
          <Text key={`${result.shell}:${result.path}`} color={result.status === "failed" ? "red" : undefined}>
            {formatResult(result)}
          </Text>
        ))}
        <Box marginTop={1} flexDirection="column">
          <Text>Open a new terminal session or reload your shell configuration.</Text>
          <Text color="gray">Enter or Esc exits.</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>cdf-setup</Text>
      {cdfRunPath ? (
        <Text color="green">Found cdf-run: {cdfRunPath}</Text>
      ) : (
        <Text color="yellow">cdf-run was not found on PATH. Install globally first, otherwise the wrapper cannot run it.</Text>
      )}
      <Text>Select the shell configurations where the `cdf` wrapper should be installed or updated.</Text>
      <Text color="gray">↑/↓ or j/k selects, Space toggles, Enter installs, Esc cancels.</Text>
      <Box flexDirection="column" marginTop={1}>
        {targets.map((target, index) => {
          const active = index === cursorIndex;
          const selected = selectedPaths.has(target.path);

          return (
            <Text key={`${target.shell}:${target.path}`} color={active ? "cyan" : undefined}>
              {active ? "> " : "  "}[{selected ? "x" : " "}] {target.shell} <Text color="gray">{target.path}</Text>
            </Text>
          );
        })}
      </Box>
    </Box>
  );
}

function formatResult(result: SetupResult): string {
  const prefix = `- ${result.shell}:`;

  if (result.status === "failed") {
    return `${prefix} failed in ${result.path}: ${result.error ?? "unknown error"}`;
  }

  if (result.status === "skipped") {
    return `${prefix} skipped, file does not exist: ${result.path}`;
  }

  if (result.status === "updated") {
    return `${prefix} updated in ${result.path}`;
  }

  return `${prefix} installed in ${result.path}`;
}
