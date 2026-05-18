import {mkdir} from "node:fs/promises";
import {join} from "node:path";

const distDirectory = join(import.meta.dir, "..", "dist");

const targets = [
  {
    name: "cdf-run",
    entrypoint: "src/index.tsx",
    outfile: "dist/cdf-run.exe",
  },
  {
    name: "cdf-setup",
    entrypoint: "src/setup.tsx",
    outfile: "dist/cdf-setup.exe",
  },
] as const;

await mkdir(distDirectory, {recursive: true});

for (const target of targets) {
  const result = await Bun.build({
    entrypoints: [target.entrypoint],
    target: "bun",
    format: "esm",
    define: {
      "process.env.NODE_ENV": '"production"',
      "process.env.DEV": '"false"',
    },
    minify: true,
    compile: {
      outfile: target.outfile,
    },
    throw: false,
  });

  if (!result.success) {
    console.error(`Failed to build ${target.name}:`);

    for (const log of result.logs) {
      console.error(log.message);
    }

    process.exit(1);
  }

  console.log(`Built ${target.outfile}`);
}
