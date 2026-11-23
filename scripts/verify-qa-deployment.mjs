const expectedSha = process.argv[2];
if (!/^[0-9a-f]{40}$/.test(expectedSha ?? '')) throw new Error('Provide the expected full source commit SHA.');

const base = new URL('https://mirpkered.github.io/arrow-adventure-qa/');
const readJson = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
};
const record = await readJson(new URL('qa-deployment.json', base));
if (record.environment !== 'qa' || record.sourceRepository !== 'mirpkered/arrow-adventure' || record.sourceCommit !== expectedSha) {
  throw new Error(`QA metadata did not identify the expected source commit ${expectedSha}.`);
}

const runId = String(record.workflowRun ?? '').match(/\/actions\/runs\/(\d+)$/)?.[1];
if (!runId) throw new Error('QA metadata does not contain a valid workflow run URL.');
const run = await readJson(`https://api.github.com/repos/mirpkered/arrow-adventure-qa/actions/runs/${runId}`);
if (run.status !== 'completed' || run.conclusion !== 'success') throw new Error(`QA workflow ${runId} did not complete successfully.`);

const pageResponse = await fetch(base, { signal: AbortSignal.timeout(15000) });
if (!pageResponse.ok) throw new Error(`QA page returned HTTP ${pageResponse.status}`);
const html = await pageResponse.text();
const urls = new Set();
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const url = new URL(match[1], base);
  if (url.origin === base.origin && url.pathname.startsWith(base.pathname)) urls.add(url.href);
}
const manifestUrl = [...urls].find((url) => new URL(url).pathname.endsWith('/site.webmanifest'));
if (!manifestUrl) throw new Error('QA page does not reference its project-path manifest.');
const manifest = await readJson(manifestUrl);
if (manifest.name !== 'Arrow Adventure' || manifest.short_name !== 'Arrow Adventure') throw new Error('QA manifest has unexpected app branding.');
for (const icon of manifest.icons ?? []) urls.add(new URL(icon.src, manifestUrl).href);
for (const path of ['branding/arrow-adventure-official-logo.png', 'branding/mirpworks-logo.jpg']) urls.add(new URL(path, base).href);

const checked = [];
for (const url of urls) {
  const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`QA asset ${url} returned HTTP ${response.status}`);
  checked.push({ url, status: response.status });
}
console.log(JSON.stringify({ sourceCommit: expectedSha, workflowRun: record.workflowRun, assets: checked.length }, null, 2));
