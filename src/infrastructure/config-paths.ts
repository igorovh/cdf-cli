import {join} from "node:path";
import {homedir} from "node:os";

export const cdfConfigDirectory = join(homedir(), ".config", "cdf");
export const pathsJsonPath = join(cdfConfigDirectory, "paths.json");
