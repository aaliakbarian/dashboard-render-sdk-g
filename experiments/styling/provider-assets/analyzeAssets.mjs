// POC / EXPERIMENT / NOT FOR PRODUCTION
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const profile = process.argv[2];
if (profile !== 'root' && profile !== 'nested') throw new Error('Expected root or nested profile.');
const root = `artifacts/experiments/provider-assets/${profile}`;
const deploymentBase = profile === 'nested' ? '/app/sdk/' : '/';

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  }))).flat();
}

const paths = (await files(root)).filter((path) => !path.includes('/evidence/asset-inventory.json'));
const bundleEvidence = JSON.parse(await readFile(`${root}/evidence/bundle-evidence.json`, 'utf8'));
const cssUrls = [];
const inventory = [];
const externalUrls = [];
const forbiddenEditorAssets = [];

for (const identity of bundleEvidence.moduleIds) {
  if (/(?:^|\/)(?:monaco-editor|@monaco-editor|@uiw\/react-codemirror|@codemirror|react-monaco)(?:\/|$)|(?:^|\/)TextPanelEditor\.[cm]?[jt]sx?$|(?:^|\/)codicon[^/]*\.(?:css|ttf)$/i.test(identity)) {
    forbiddenEditorAssets.push(identity);
  }
}

for (const path of paths) {
  const file = relative(root, path).replaceAll('\\', '/');
  const body = await readFile(path);
  const lower = file.toLowerCase();
  if (/(?:monaco|react-monaco|codemirror|codicon|textpaneleditor)/i.test(file)) {
    forbiddenEditorAssets.push(file);
  }
  const extension = extname(file).toLowerCase();
  if (!['.css', '.woff2', '.svg'].includes(extension)) continue;
  const text = extension === '.css' || extension === '.svg' ? body.toString('utf8') : '';
  if (extension === '.css') {
    for (const match of text.matchAll(/url\((['"]?)([^)'"\s]+)\1\)/g)) {
      cssUrls.push(match[2]);
      if (/^(?:https?:)?\/\//i.test(match[2])) externalUrls.push(match[2]);
    }
  }
  const isRegular = /Inter-Regular-.*\.woff2$/.test(file);
  const isMedium = /Inter-Medium-.*\.woff2$/.test(file);
  const isIcon = file.endsWith('provider-assets/build/img/icons/unicons/times.svg');
  const isVisualization = extension === '.css' && file.includes('provider-visualization-');
  const isSlider = extension === '.css' && file.includes('lib-') && text.includes('.rc-slider');
  const isHost = extension === '.css' && text.includes('.asset-host');
  const category = isRegular || isMedium ? 'FONT' : isIcon ? 'ICON' : isVisualization ? 'VISUALIZATION_ASSET' : extension === '.svg' ? 'SVG' : 'CSS';
  const source = isRegular
    ? '<grafana-source>/public/fonts/inter/Inter-Regular.woff2'
    : isMedium
      ? '<grafana-source>/public/fonts/inter/Inter-Medium.woff2'
      : isIcon
        ? '<grafana-source>/public/img/icons/unicons/times.svg'
        : isVisualization
          ? '<repo>/node_modules/uplot/dist/uPlot.min.css'
          : isSlider
            ? '<repo>/node_modules/@rc-component/slider/assets/index.css'
            : isHost
              ? '<repo>/experiments/styling/provider-assets/host CSS graph'
              : '<repo>/provider view CSS graph';
  const isGrafanaAsset = isRegular || isMedium || isIcon;
  const sourcePackage = isGrafanaAsset
    ? 'grafana/grafana'
    : isVisualization
      ? 'uplot'
      : isSlider
        ? '@rc-component/slider'
        : 'dashboard-render-sdk-g';
  const sourceVersion = isGrafanaAsset
    ? '13.2.3'
    : isVisualization
      ? '1.6.32'
      : isSlider
        ? '1.2.1'
        : 'unpublished-experiment';
  const licenseEvidence = isGrafanaAsset
    ? '<grafana-source>/LICENSING.md and NOTICE.md'
    : isVisualization
      ? '<repo>/node_modules/uplot/LICENSE'
      : isSlider
        ? '<repo>/node_modules/@rc-component/slider/LICENSE'
        : '<repo>/LICENSE';
  inventory.push({
    category,
    consumer: isIcon ? 'grafana-modal-close' : isVisualization ? 'timeseries' : category === 'FONT' ? 'provider-typography' : 'provider-presentation',
    file,
    hash: `sha256-${createHash('sha256').update(body).digest('hex')}`,
    licenseEvidence,
    loadTiming: isIcon ? 'on-overlay-open' : category === 'FONT' ? 'on-css-use' : isVisualization ? 'on-timeseries-load' : 'eager',
    owner: isHost ? 'host' : 'provider',
    size: body.byteLength,
    sourceCommit: isGrafanaAsset ? '6193dc03311b631b9727b560d24369e683dc396e' : null,
    sourcePackage,
    source,
    sourceVersion,
    url: `${deploymentBase}${file}`.replace(/\/+/g, '/'),
  });
}

await mkdir(`${root}/evidence`, { recursive: true });
await writeFile(`${root}/evidence/asset-inventory.json`, `${JSON.stringify({
  cssUrls: [...new Set(cssUrls)].sort(),
  externalUrls: [...new Set(externalUrls)].sort(),
  forbiddenEditorAssets: [...new Set(forbiddenEditorAssets)].sort(),
  generatedBy: 'provider-assets-inventory-v1',
  inventory: inventory.sort((left, right) => left.file.localeCompare(right.file)),
  profile,
}, null, 2)}\n`);
