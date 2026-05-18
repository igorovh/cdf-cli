import {existsSync} from "node:fs";
import {readFile, writeFile} from "node:fs/promises";
import {homedir} from "node:os";
import {join} from "node:path";

const startMarker = "# >>> cdf >>>";
const endMarker = "# <<< cdf <<<";

export type SetupResult = {
  shell: "bash" | "zsh" | "nushell";
  path: string;
  status: "installed" | "updated" | "skipped" | "failed";
  error?: string;
};

export type ShellConfigTarget = {
  shell: SetupResult["shell"];
  path: string;
  block: string;
};

export async function installShellWrappers(targets: ShellConfigTarget[]): Promise<SetupResult[]> {
  const results: SetupResult[] = [];

  for (const target of targets) {
    results.push(await installShellWrapper(target));
  }

  return results;
}

export function getAvailableShellConfigTargets(): ShellConfigTarget[] {
  return getShellConfigTargets().filter((target) => existsSync(target.path));
}

export function getShellConfigTargets(): ShellConfigTarget[] {
  const home = homedir();
  const appData = process.env.APPDATA;
  const nushellConfigPaths = [
    appData ? join(appData, "nushell", "config.nu") : undefined,
    join(home, ".config", "nushell", "config.nu"),
  ].filter((path): path is string => Boolean(path));

  const targets: ShellConfigTarget[] = [
    {
      shell: "bash",
      path: join(home, ".bashrc"),
      block: bashOrZshBlock(),
    },
    {
      shell: "zsh",
      path: join(home, ".zshrc"),
      block: bashOrZshBlock(),
    },
  ];

  for (const path of unique(nushellConfigPaths)) {
    targets.push({
      shell: "nushell",
      path,
      block: nushellBlock(),
    });
  }

  return targets;
}

export function bashOrZshBlock(): string {
  return `${startMarker}
cdf() {
  local target
  target="$(command cdf-run "$@")" || return

  if [ -n "$target" ]; then
    cd "$target"
  fi
}
${endMarker}`;
}

export function nushellBlock(): string {
  return `${startMarker}
def --env cdf [] {
    let target = (^cdf-run | str trim)

    if ($target | is-not-empty) {
        cd $target
    }
}
${endMarker}`;
}

async function installShellWrapper(target: ShellConfigTarget): Promise<SetupResult> {
  if (!existsSync(target.path)) {
    return {shell: target.shell, path: target.path, status: "skipped"};
  }

  try {
    const existingContent = await readFile(target.path, "utf8");
    const nextContent = upsertMarkedBlock(existingContent, target.block);
    const status = nextContent.replaced ? "updated" : "installed";

    await writeFile(target.path, nextContent.content, "utf8");

    return {shell: target.shell, path: target.path, status};
  } catch (error) {
    return {
      shell: target.shell,
      path: target.path,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function upsertMarkedBlock(content: string, block: string): {content: string; replaced: boolean} {
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker, startIndex + startMarker.length);

  if (startIndex >= 0 && endIndex >= 0) {
    const afterEndIndex = endIndex + endMarker.length;
    const contentBefore = content.slice(0, startIndex).replace(/\n*$/, "");
    const contentAfter = content.slice(afterEndIndex).replace(/^\n*/, "");
    const sections = [contentBefore, block, contentAfter].filter((section) => section.length > 0);

    return {content: `${sections.join("\n\n")}\n`, replaced: true};
  }

  const separator = content.endsWith("\n") || content.length === 0 ? "" : "\n";

  if (content.length === 0) {
    return {content: `${block}\n`, replaced: false};
  }

  return {content: `${content}${separator}\n${block}\n`, replaced: false};
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
