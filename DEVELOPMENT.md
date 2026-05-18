# Development

## Local Setup

```bash
bun install
```

Run the app locally:

```bash
bun run cdf-run
```

Run setup locally:

```bash
bun run cdf-setup
```

Typecheck:

```bash
bun run typecheck
```

## Standalone Executables

Build local standalone executables:

```bash
bun run build
```

Output:

```text
dist/cdf-run.exe
dist/cdf-setup.exe
```

Optional local Windows-style standalone install:

```bash
bun run install-global -- --yes
```

Useful installer flags:

```bash
bun run install-global -- --dry-run
bun run install-global -- --yes
bun run install-global -- --no-path
```

## Startup Profiling

Profile startup without selecting a path:

```bash
cdf-run --profile-startup --profile-exit
```

Profile a real interactive selection:

```bash
cdf-run --profile-startup
```

Profiler output is written to `stderr`, so selected path output on `stdout` remains safe for shell wrappers.

## npm Package

Dry-run package contents:

```bash
npm pack --dry-run
```

Publish:

```bash
npm login
npm publish
```

The npm package is intended to be installed with:

```bash
bun i -g cdf-cli
cdf-setup
```

`bun i -g cdf-cli` installs the `cdf-run` and `cdf-setup` commands. `cdf-setup` remains a required explicit step because installing a package should not silently edit a user's shell configuration.

## Project Structure

```text
src/domain              Core path entry/search logic
src/infrastructure      Storage, config paths, shell setup, PATH lookup
src/ui                  Ink UI components
src/index.tsx           cdf-run entrypoint
src/setup.tsx           cdf-setup entrypoint
scripts/build.ts        Standalone executable build
scripts/install-global.ts Local standalone installer
```
