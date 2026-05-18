#!/usr/bin/env bun
const startedAt = performance.now();
const profileStartup = process.argv.includes("--profile-startup") || process.env.CDF_PROFILE === "1";
const profileExit = process.argv.includes("--profile-exit");

function profile(event: string): void {
  if (!profileStartup) {
    return;
  }

  const elapsed = performance.now() - startedAt;
  process.stderr.write(`[cdf profile] ${event}: ${elapsed.toFixed(1)}ms\n`);
}

profile("process started");

if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
  console.error("cdf-run requires an interactive terminal with raw mode support.");
  console.error("Run `cdf-run` or the `cdf` wrapper directly in a terminal, not through a non-interactive runner.");
  process.exit(1);
}

profile("tty checked");

const [{default: React}, {render}, {App}] = await Promise.all([
  import("react"),
  import("ink"),
  import("./ui/App"),
]);

profile("imports loaded");

let selectedPath: string | undefined;
let firstRenderLogged = false;
let storageLoaded = false;
let readyRenderLogged = false;

const instance = render(
  React.createElement(App, {
    onSelect: (path: string) => {
      selectedPath = path;
    },
    onProfile: (event: string) => {
      profile(event);

      if (event.startsWith("storage loaded")) {
        storageLoaded = true;
      }
    },
  }),
  {
    stdout: process.stderr,
    stderr: process.stderr,
    stdin: process.stdin,
    patchConsole: false,
    onRender: () => {
      if (!firstRenderLogged) {
        firstRenderLogged = true;
        profile("first render committed");
      }

      if (profileExit && storageLoaded && !readyRenderLogged) {
        readyRenderLogged = true;
        profile("ready render committed");
        queueMicrotask(() => {
          instance.unmount();
        });
      }
    },
  },
);

profile("render started");

await instance.waitUntilExit();
profile("app exited");

if (selectedPath) {
  profile("selected path written");
  await Bun.write(Bun.stdout, `${selectedPath}\n`);
}
