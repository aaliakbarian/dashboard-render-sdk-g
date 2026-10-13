// POC / NOT FOR PRODUCTION
// This probe uses only provider-controlled paths from the exact pinned fixture.
// Dashboard content never selects a module URL.
import { expect, test } from '@playwright/test';

const PINNED_ASSETS = {
  stat: '/grafana/public/build/statPanel.280c9ee0cecc3c4a4196.js',
  testData: '/grafana/public/plugins/grafana-testdata-datasource/module.js',
  text: '/grafana/public/build/textPanel.42bb49ae047235dce251.js',
  timeSeries: '/grafana/public/build/timeseriesPanel.0f2547f55a3ac4b6cb5e.js',
} as const;

interface SanitizedAssetEvidence {
  readonly cacheControl: string;
  readonly contentLength: string;
  readonly contentType: string;
  readonly path: string;
  readonly resourceType: string;
  readonly status: number;
}

function sanitizeResponse(response: import('@playwright/test').Response): SanitizedAssetEvidence {
  const headers = response.headers();
  return {
    cacheControl: headers['cache-control'] ?? '',
    contentLength: headers['content-length'] ?? '',
    contentType: headers['content-type'] ?? '',
    path: new URL(response.url()).pathname,
    resourceType: response.request().resourceType(),
    status: response.status(),
  };
}

async function login(page: import('@playwright/test').Page): Promise<void> {
  const user = process.env.POC_GRAFANA_VERIFY_USER;
  const password = process.env.POC_GRAFANA_VERIFY_PASSWORD;
  if (!user || !password) {
    throw new Error('The disposable Grafana fixture credentials are required.');
  }

  const response = await page.request.post('/grafana/login', {
    data: { user, password },
  });
  expect(response.status()).toBe(200);
}

test.use({ trace: 'off' });

test('records the reference UI asset graph and closed plugin metadata', async ({ page }) => {
  await login(page);

  const assets = new Map<string, SanitizedAssetEvidence>();
  page.on('response', (response) => {
    const evidence = sanitizeResponse(response);
    if (/\.(?:css|js)$/.test(evidence.path)) {
      assets.set(evidence.path, evidence);
    }
  });

  await page.goto('/grafana/d/grsdk-phase0-poc/grsdk-phase0-poc?from=now-1h&to=now');
  await expect(page.getByText('Text — phase0', { exact: true })).toBeVisible();
  await expect(page.getByText('Stat — predictable pulse', { exact: true })).toBeVisible();
  await expect(page.getByText('Time series — predictable pulse', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Time series — predictable pulse' }).locator('canvas').first()).toBeVisible();

  await expect.poll(() => assets.has(PINNED_ASSETS.text)).toBe(true);
  await expect.poll(() => assets.has(PINNED_ASSETS.stat)).toBe(true);
  await expect.poll(() => assets.has(PINNED_ASSETS.timeSeries)).toBe(true);
  await expect.poll(() => assets.has(PINNED_ASSETS.testData)).toBe(true);

  const panelMetadata = await page.evaluate(() => {
    const bootData = (window as typeof window & {
      grafanaBootData?: {
        settings?: {
          panels?: Record<string, {
            id?: string;
            info?: { version?: string };
            module?: string;
          }>;
        };
      };
    }).grafanaBootData;
    const panels = bootData?.settings?.panels ?? {};
    return Object.fromEntries(
      ['text', 'stat', 'timeseries'].map((id) => [
        id,
        {
          id: panels[id]?.id ?? id,
          module: panels[id]?.module ?? '',
          version: panels[id]?.info?.version ?? '',
        },
      ])
    );
  });

  const testDataSettingsResponse = await page.request.get(
    '/grafana/api/plugins/grafana-testdata-datasource/settings'
  );
  expect(testDataSettingsResponse.status()).toBe(200);
  const rawTestDataSettings = (await testDataSettingsResponse.json()) as Record<string, unknown>;
  const testDataSettings = {
    angularDetected: rawTestDataSettings.angularDetected,
    id: rawTestDataSettings.id,
    loadingStrategy: rawTestDataSettings.loadingStrategy,
    module: rawTestDataSettings.module,
    moduleHash: rawTestDataSettings.moduleHash ?? '',
    signature: rawTestDataSettings.signature,
    type: rawTestDataSettings.type,
    version:
      typeof rawTestDataSettings.info === 'object' && rawTestDataSettings.info
        ? (rawTestDataSettings.info as { version?: unknown }).version
        : undefined,
  };

  const assetManifestResponse = await page.request.get('/grafana/public/build/assets-manifest.json');
  expect(assetManifestResponse.status()).toBe(200);
  const assetManifest = (await assetManifestResponse.json()) as Record<string, unknown>;

  const targetAssets = Object.values(PINNED_ASSETS).map((path) => assets.get(path));
  expect(targetAssets.every(Boolean)).toBe(true);
  expect(Object.keys(assetManifest).some((key) => key.includes('textPanel'))).toBe(false);
  expect(panelMetadata).toEqual({
    stat: { id: 'stat', module: 'core:plugin/stat', version: '' },
    text: { id: 'text', module: 'core:plugin/text', version: '' },
    timeseries: { id: 'timeseries', module: 'core:plugin/timeseries', version: '' },
  });
  expect(testDataSettings).toMatchObject({
    angularDetected: false,
    id: 'grafana-testdata-datasource',
    loadingStrategy: 'script',
    module: 'public/plugins/grafana-testdata-datasource/module.js',
    moduleHash: '',
    type: 'datasource',
  });

  console.log(
    'SERVER_HOSTED_REFERENCE_EVIDENCE',
    JSON.stringify({
      assetManifestPanelEntries: Object.keys(assetManifest).filter((key) => /Panel/.test(key)),
      jsCssRequestCount: assets.size,
      panelMetadata,
      requestedAssets: [...assets.values()].sort((left, right) =>
        left.path.localeCompare(right.path)
      ),
      targetAssets,
      testDataSettings,
    })
  );
});

test('probes exact same-origin artifacts without Grafana shell bootstrap', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('poc-host-shell')).toBeVisible();

  const result = await page.evaluate(async (paths) => {
    const classify = async (path: string) => {
      const response = await fetch(path, { credentials: 'same-origin' });
      const source = await response.text();
      return {
        contentType: response.headers.get('content-type') ?? '',
        format: source.includes('self.webpackChunkgrafana')
          ? 'webpack-jsonp-chunk'
          : /^\s*(?:\/\*[\s\S]*?\*\/\s*)?define\(/.test(source)
            ? 'amd-define'
            : 'other',
        ok: response.ok,
        path: new URL(response.url).pathname,
        status: response.status,
      };
    };

    const beforeQueueLength = (globalThis as typeof globalThis & {
      webpackChunkgrafana?: unknown[];
    }).webpackChunkgrafana?.length ?? 0;

    let textImport: Record<string, unknown>;
    try {
      const loaded = await import(/* @vite-ignore */ paths.text);
      textImport = {
        outcome: 'loaded-without-plugin-export',
        exports: Object.keys(loaded),
      };
    } catch (error) {
      textImport = {
        errorName: error instanceof Error ? error.name : 'UnknownError',
        outcome: 'rejected',
      };
    }

    const afterQueueLength = (globalThis as typeof globalThis & {
      webpackChunkgrafana?: unknown[];
    }).webpackChunkgrafana?.length ?? 0;

    let testDataImport: Record<string, unknown>;
    try {
      const loaded = await import(/* @vite-ignore */ paths.testData);
      testDataImport = { exports: Object.keys(loaded), outcome: 'loaded' };
    } catch (error) {
      testDataImport = {
        errorMessage:
          error instanceof Error && /define is not defined/.test(error.message)
            ? 'define is not defined'
            : 'sanitized-load-error',
        errorName: error instanceof Error ? error.name : 'UnknownError',
        outcome: 'rejected',
      };
    }

    return {
      formats: {
        testData: await classify(paths.testData),
        text: await classify(paths.text),
      },
      grafanaAppPresent: 'GrafanaApp' in globalThis,
      iframeCount: document.querySelectorAll('iframe').length,
      navigationLandmarkCount: document.querySelectorAll('[aria-label="Grafana navigation"]').length,
      testDataImport,
      textImport,
      webpackQueueDelta: afterQueueLength - beforeQueueLength,
    };
  }, PINNED_ASSETS);

  expect(result.formats.text).toMatchObject({
    format: 'webpack-jsonp-chunk',
    ok: true,
    status: 200,
  });
  expect(result.textImport).toEqual({
    exports: [],
    outcome: 'loaded-without-plugin-export',
  });
  expect(result.webpackQueueDelta).toBe(1);

  expect(result.formats.testData).toMatchObject({
    format: 'amd-define',
    ok: true,
    status: 200,
  });
  expect(result.testDataImport).toEqual({
    errorMessage: 'define is not defined',
    errorName: 'ReferenceError',
    outcome: 'rejected',
  });

  expect(result).toMatchObject({
    grafanaAppPresent: false,
    iframeCount: 0,
    navigationLandmarkCount: 0,
  });

  console.log('SERVER_HOSTED_SAME_ORIGIN_EVIDENCE', JSON.stringify(result));
});
