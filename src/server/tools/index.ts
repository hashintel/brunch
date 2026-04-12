import { createBashTool } from './bash.js';
import { createEditTool } from './edit.js';
import { createFindTool } from './find.js';
import { createGrepTool } from './grep.js';
import { createLsTool } from './ls.js';
import { createReadTool } from './read.js';
import { createWriteTool } from './write.js';

export { createReadTool } from './read.js';
export { createWriteTool } from './write.js';
export { createEditTool } from './edit.js';
export { createBashTool } from './bash.js';
export { createGrepTool } from './grep.js';
export { createFindTool } from './find.js';
export { createLsTool } from './ls.js';

/** Create the full set of core tools bound to a working directory. */
export function createCoreTools(cwd: string) {
  return {
    read_file: createReadTool(cwd),
    write_file: createWriteTool(cwd),
    edit_file: createEditTool(cwd),
    bash: createBashTool(cwd),
    grep: createGrepTool(cwd),
    find_files: createFindTool(cwd),
    list_directory: createLsTool(cwd),
  };
}

/** Create the read-only exploration tools available during brownfield scope discovery. */
export function createExplorationTools(cwd: string) {
  return {
    read_file: createReadTool(cwd),
    grep: createGrepTool(cwd),
    find_files: createFindTool(cwd),
    list_directory: createLsTool(cwd),
  };
}
