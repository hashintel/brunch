import { exitIfAnthropicApiKeyMissing, loadLocalEnvFile } from './runtime-config.js';

// Gates `npm run dev` before `tsx --watch` starts; under --watch, process.exit() only restarts.
loadLocalEnvFile(process.cwd());
exitIfAnthropicApiKeyMissing();
