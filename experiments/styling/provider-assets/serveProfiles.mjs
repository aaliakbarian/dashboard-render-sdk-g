// POC / EXPERIMENT / NOT FOR PRODUCTION
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const providerConfig = resolve(repositoryRoot, 'experiments/styling/provider-assets/vite.provider.config.ts');
const hostConfig = resolve(repositoryRoot, 'experiments/styling/provider-assets/vite.host.config.ts');
const analyzer = resolve(repositoryRoot, 'experiments/styling/provider-assets/analyzeAssets.mjs');

await build({ configFile: providerConfig });
for (const profile of ['root', 'nested']) {
  process.env.PROVIDER_ASSET_PROFILE = profile;
  await build({ configFile: hostConfig });
  const analyzed = spawnSync(process.execPath, [analyzer, profile], { cwd: repositoryRoot, stdio: 'inherit' });
  if (analyzed.status !== 0) throw new Error(`Asset evidence failed for ${profile}.`);
}

process.env.POC_VITE_HOST = '0.0.0.0';
process.env.PROVIDER_ASSET_PROFILE = 'root';
const rootServer = await preview({ configFile: hostConfig });
process.env.PROVIDER_ASSET_PROFILE = 'nested';
const nestedServer = await preview({ configFile: hostConfig });

const shutdown = () => {
  rootServer.httpServer.close();
  nestedServer.httpServer.close();
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

await new Promise(() => undefined);
