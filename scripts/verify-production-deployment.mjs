const [expectedSha, expectedWorkflowRun] = process.argv.slice(2);
if (!/^[0-9a-f]{40}$/.test(expectedSha ?? '')
  || !/^https:\/\/github\.com\/mirpkered\/arrow-adventure\/actions\/runs\/\d+$/.test(expectedWorkflowRun ?? '')) {
  throw new Error('Provide the expected full source SHA and production workflow run URL.');
}

const base = new URL('https://mirpkered.github.io/arrow-adventure/');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fetchWithRetry = async (url, options = {}) => {
  let lastError;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
      if (response.ok) return response;
      lastError = new Error(`${url} returned HTTP ${response.status}`);
    } catch (error) { lastError = error; }
    await pause(5000);
  }
  throw lastError;
};
const readJson = async (url) => (await fetchWithRetry(url)).json();

const record = await readJson(new URL('deployment.json', base));
if (record.environment !== 'production' || record.sourceRepository !== 'mirpkered/arrow-adventure'
  || record.sourceCommit !== expectedSha || record.productionWorkflowRun !== expectedWorkflowRun
  || 'qaWorkflowRun' in record) {
  throw new Error(`Production metadata does not identify the expected QA-independent source ${expectedSha}.`);
}

const page = await fetchWithRetry(base);
const html = await page.text();
const urls = new Set();
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const url = new URL(match[1], base);
  if (url.origin === base.origin && url.pathname.startsWith(base.pathname)) urls.add(url.href);
}
const manifestUrl = [...urls].find((url) => new URL(url).pathname.endsWith('/site.webmanifest'));
if (!manifestUrl) throw new Error('Production page does not reference its project-path manifest.');
const manifest = await readJson(manifestUrl);
if (manifest.name !== 'Arrow Adventure' || manifest.short_name !== 'Arrow Adventure') throw new Error('Production manifest branding is invalid.');
for (const icon of manifest.icons ?? []) urls.add(new URL(icon.src, manifestUrl).href);
for (const path of ['branding/arrow-adventure-official-logo.png', 'branding/mirpworks-logo.jpg']) urls.add(new URL(path, base).href);

const checked = [];
for (const url of urls) {
  const response = await fetchWithRetry(url, { method: 'HEAD' });
  checked.push({ url, status: response.status });
}
console.log(JSON.stringify({ sourceCommit: expectedSha, workflowRun: expectedWorkflowRun, pageStatus: page.status, assets: checked.length }, null, 2));
