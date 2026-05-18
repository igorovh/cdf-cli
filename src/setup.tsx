#!/usr/bin/env bun
import React from "react";
import {render} from "ink";

import {findCommandOnPath} from "./infrastructure/command-path";
import {getAvailableShellConfigTargets} from "./infrastructure/shell-setup";
import {SetupApp} from "./ui/SetupApp";

if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
  console.error("cdf-setup requires an interactive terminal with raw mode support.");
  console.error("Run `cdf-setup` directly in a terminal, not through a non-interactive runner.");
  process.exit(1);
}

const targets = getAvailableShellConfigTargets();
const cdfRunPath = findCommandOnPath("cdf-run") ?? findCommandOnPath("cdf-run.exe");
const instance = render(<SetupApp targets={targets} cdfRunPath={cdfRunPath} />, {
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
});

await instance.waitUntilExit();
