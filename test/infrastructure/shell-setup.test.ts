import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  bashOrZshBlock,
  getAvailableShellConfigTargets,
  getShellConfigTargets,
  installShellWrappers,
  nushellBlock,
} from "../../src/infrastructure/shell-setup";

describe("bashOrZshBlock", () => {
  test("contains start marker", () => {
    expect(bashOrZshBlock()).toContain("# >>> cdf >>>");
  });

  test("contains end marker", () => {
    expect(bashOrZshBlock()).toContain("# <<< cdf <<<");
  });

  test("contains a shell function definition", () => {
    const block = bashOrZshBlock();
    expect(block).toContain("cdf()");
    expect(block).toContain("command cdf-run");
    expect(block).toContain("cd");
  });
});

describe("nushellBlock", () => {
  test("contains start marker", () => {
    expect(nushellBlock()).toContain("# >>> cdf >>>");
  });

  test("contains end marker", () => {
    expect(nushellBlock()).toContain("# <<< cdf <<<");
  });

  test("contains a nushell function definition", () => {
    const block = nushellBlock();
    expect(block).toContain("def --env cdf");
    expect(block).toContain("cdf-run");
    expect(block).toContain("cd");
  });
});

describe("getShellConfigTargets", () => {
  test("returns an array", () => {
    const targets = getShellConfigTargets();
    expect(Array.isArray(targets)).toBe(true);
    expect(targets.length).toBeGreaterThanOrEqual(2);
  });

  test("contains bash entry with correct path", () => {
    const targets = getShellConfigTargets();
    const bashTarget = targets.find((t) => t.shell === "bash");
    expect(bashTarget).toBeDefined();
    expect(bashTarget!.path).toEndWith(".bashrc");
  });

  test("contains zsh entry with correct path", () => {
    const targets = getShellConfigTargets();
    const zshTarget = targets.find((t) => t.shell === "zsh");
    expect(zshTarget).toBeDefined();
    expect(zshTarget!.path).toEndWith(".zshrc");
  });

  test("each target has shell, path, and block", () => {
    for (const target of getShellConfigTargets()) {
      expect(target).toHaveProperty("shell");
      expect(target).toHaveProperty("path");
      expect(target).toHaveProperty("block");
      expect(typeof target.block).toBe("string");
      expect(target.block.length).toBeGreaterThan(0);
    }
  });

  test("bash and zsh share the same block", () => {
    const targets = getShellConfigTargets();
    const bashTarget = targets.find((t) => t.shell === "bash");
    const zshTarget = targets.find((t) => t.shell === "zsh");
    expect(bashTarget!.block).toBe(zshTarget!.block);
  });

  test("nushell block differs from bash/zsh block", () => {
    const targets = getShellConfigTargets();
    const bashTarget = targets.find((t) => t.shell === "bash");
    const nuTargets = targets.filter((t) => t.shell === "nushell");
    for (const nuTarget of nuTargets) {
      expect(nuTarget.block).not.toBe(bashTarget!.block);
    }
  });

  test("nushell targets (if any) have config.nu path", () => {
    const targets = getShellConfigTargets();
    const nuTargets = targets.filter((t) => t.shell === "nushell");
    for (const nuTarget of nuTargets) {
      expect(nuTarget.path).toEndWith("config.nu");
    }
  });

  test("all paths are absolute", () => {
    for (const target of getShellConfigTargets()) {
      expect(target.path).toStartWith(homedir());
      expect(target.path).not.toContain("..");
    }
  });
});

describe("getAvailableShellConfigTargets", () => {
  test("returns only targets whose config files exist", () => {
    const targets = getAvailableShellConfigTargets();
    for (const target of targets) {
      expect(target).toHaveProperty("shell");
      expect(target).toHaveProperty("path");
      expect(target).toHaveProperty("block");
    }
  });
});

describe("installShellWrappers", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("returns skipped when config file does not exist", async () => {
    tmpDir = mkdtempSync(join(homedir(), "cdf-test-shell-"));
    const results = await installShellWrappers([
      {
        shell: "bash",
        path: join(tmpDir, "nonexistent.sh"),
        block: "# test block",
      },
    ]);
    expect(results).toHaveLength(1);
    expect(results[0]!.status).toBe("skipped");
  });

  test("installs block when config file exists and is empty", async () => {
    tmpDir = mkdtempSync(join(homedir(), "cdf-test-shell-"));
    const configPath = join(tmpDir, "testrc");
    writeFileSync(configPath, "", "utf8");

    const results = await installShellWrappers([
      {
        shell: "bash",
        path: configPath,
        block: bashOrZshBlock(),
      },
    ]);
    expect(results).toHaveLength(1);
    expect(results[0]!.status).toBe("installed");
  });

  test("updates block when config file already has a cdf block", async () => {
    tmpDir = mkdtempSync(join(homedir(), "cdf-test-shell-"));
    const configPath = join(tmpDir, "testrc");
    writeFileSync(configPath, "echo hello\n# >>> cdf >>>\nold block\n# <<< cdf <<<\necho world\n", "utf8");

    const newBlock = bashOrZshBlock();
    const results = await installShellWrappers([
      {
        shell: "bash",
        path: configPath,
        block: newBlock,
      },
    ]);
    expect(results).toHaveLength(1);
    expect(results[0]!.status).toBe("updated");
  });

  test("installs block into non-empty config file without existing cdf block", async () => {
    tmpDir = mkdtempSync(join(homedir(), "cdf-test-shell-"));
    const configPath = join(tmpDir, "testrc");
    writeFileSync(configPath, "echo hello\n", "utf8");

    const results = await installShellWrappers([
      {
        shell: "bash",
        path: configPath,
        block: bashOrZshBlock(),
      },
    ]);
    expect(results).toHaveLength(1);
    expect(results[0]!.status).toBe("installed");
  });

  test("installs multiple shell wrappers", async () => {
    tmpDir = mkdtempSync(join(homedir(), "cdf-test-shell-"));
    const bashPath = join(tmpDir, ".bashrc");
    const zshPath = join(tmpDir, ".zshrc");
    writeFileSync(bashPath, "", "utf8");
    writeFileSync(zshPath, "", "utf8");

    const results = await installShellWrappers([
      { shell: "bash", path: bashPath, block: bashOrZshBlock() },
      { shell: "zsh", path: zshPath, block: bashOrZshBlock() },
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]!.status).toBe("installed");
    expect(results[1]!.status).toBe("installed");
  });
});
