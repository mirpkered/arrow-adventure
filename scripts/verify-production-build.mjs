import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const outputDirectory = resolve(process.argv[2] ?? 'dist');
if (!statSync(outputDirectory).isDirectory()) throw new Error(`Build output not found: ${outputDirectory}`);
const basePath = '/arrow-adventure/';
const html = readFileSync(join(outputDirectory, 'index.html'), 'utf8');
if (!html.includes(basePath)) throw new Error(`index.html does not use ${basePath}`);
const assetsDirectory = join(outputDirectory, 'assets');
const assetFiles = readdirSync(assetsDirectory);
if (!assetFiles.some((file) => file.endsWith('.js')) || !assetFiles.some((file) => file.endsWith('.css'))) {
  throw new Error('Production output is missing JavaScript or CSS assets');
}
if (assetFiles.some((file) => /^(qaPanel|prototypeReview)-/.test(file))) {
  throw new Error('Production output contains a QA-only JavaScript module');
}

const publicFiles = readdirSync(outputDirectory, { recursive: true })
  .filter((path) => typeof path === 'string').map((path) => path.replaceAll('\\', '/'));
const bundleText = publicFiles.filter((path) => /\.(?:js|html|json)$/.test(path))
  .map((path) => readFileSync(join(outputDirectory, path), 'utf8')).join('\n');
for (const marker of ['Prototype Review', 'prototype-square-true-7', 'prototype-round12-heart', 'qaPanel-', 'prototypeReview-', 'qa-deployment.json']) {
  if (bundleText.includes(marker)) throw new Error(`Production output unexpectedly contains ${marker}`);
}
if (publicFiles.some((path) => path === 'qa-deployment.json')) throw new Error('Production output contains QA deployment metadata');

const manifestLink = [...html.matchAll(/<link[^>]+rel="manifest"[^>]+href="([^"]+)"/g)][0]?.[1];
if (!manifestLink?.endsWith('/site.webmanifest')) throw new Error('Production page does not reference its project-path web manifest');
const manifestPath = manifestLink.replace(basePath, '').replace(/^\//, '');
const manifest = JSON.parse(readFileSync(join(outputDirectory, manifestPath), 'utf8'));
if (manifest.name !== 'Arrow Adventure' || manifest.short_name !== 'Arrow Adventure') throw new Error('Production manifest branding is invalid');
for (const icon of manifest.icons ?? []) {
  const iconPath = new URL(icon.src, `https://pages.invalid${basePath}${manifestPath}`).pathname.replace(basePath, '').replace(/^\//, '');
  if (!publicFiles.includes(iconPath)) throw new Error(`Production manifest icon is missing: ${icon.src}`);
}
console.log(JSON.stringify({ basePath, assets: assetFiles.length, manifest: manifest.name, qaModulesExcluded: true }, null, 2));
