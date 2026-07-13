import { copyFile, cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');
const out = resolve(root, 'out');

await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, 'client'), { recursive: true });
await cp(out, resolve(dist, 'client'), { recursive: true });
await mkdir(resolve(dist, 'server'), { recursive: true });
await mkdir(resolve(dist, '.openai'), { recursive: true });
await copyFile(resolve(root, '.openai', 'hosting.json'), resolve(dist, '.openai', 'hosting.json'));

await writeFile(resolve(dist, 'server', 'index.js'), `const immutableAsset = /\\\\.(?:js|css|png|jpg|jpeg|webp|gif|svg|ico|txt|json|map|woff2?)$/i;

function withHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  if (immutableAsset.test(new URL(response.url || 'https://asset.local/').pathname)) {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function fetchAsset(request, env) {
  if (!env?.ASSETS?.fetch) return new Response('Missing static asset binding', { status: 500 });
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const direct = await fetchAsset(request, env);
    if (direct.status !== 404) return withHeaders(direct);

    if (immutableAsset.test(url.pathname) || url.pathname.startsWith('/_next/')) {
      return direct;
    }

    const indexUrl = new URL('/index.html', url);
    const indexResponse = await fetchAsset(new Request(indexUrl, request), env);
    const headers = new Headers(indexResponse.headers);
    headers.set('Content-Type', 'text/html; charset=utf-8');
    headers.set('Cache-Control', 'no-store');
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(indexResponse.body, { status: indexResponse.status, statusText: indexResponse.statusText, headers });
  },
};
`);
