const RAW_ROOT = 'https://raw.githubusercontent.com/wafflepug/dog-calendar/release-a-rnd/rnd/';
const FUNCTION_PATH = '/functions/v1/release-a-rnd-preview';
const PROJECT_URL = 'https://bzlmqsvueoctrfnjmosq.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_CENAyc84KUaJl-PyUC9QmQ_9JF1YyKR';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' https://bzlmqsvueoctrfnjmosq.supabase.co wss://bzlmqsvueoctrfnjmosq.supabase.co",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ')
};

function response(body: string, contentType: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      ...SECURITY_HEADERS,
      'Content-Type': contentType
    }
  });
}

async function fetchBranchAsset(name: string) {
  const upstream = await fetch(`${RAW_ROOT}${name}`, {
    headers: { 'User-Agent': 'Waffle-Release-A-RnD-Preview' }
  });
  if (!upstream.ok) {
    return response('R&D preview asset unavailable.', 'text/plain; charset=utf-8', 502);
  }

  let body = await upstream.text();
  if (name === 'index.html') {
    body = body.replace('<head>', `<head>\n  <base href="${FUNCTION_PATH}/">`);
  }

  const contentType = name.endsWith('.css')
    ? 'text/css; charset=utf-8'
    : name.endsWith('.js')
      ? 'application/javascript; charset=utf-8'
      : 'text/html; charset=utf-8';
  return response(body, contentType);
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const tail = url.pathname.slice(FUNCTION_PATH.length).replace(/^\/+/, '');

  if (!tail && !url.pathname.endsWith('/')) {
    return Response.redirect(`${PROJECT_URL}${FUNCTION_PATH}/`, 302);
  }

  if (!tail || tail === 'index.html') return fetchBranchAsset('index.html');
  if (tail === 'styles.css') return fetchBranchAsset('styles.css');
  if (tail === 'app.js') return fetchBranchAsset('app.js');
  if (tail === 'config.js') {
    return response(
      `window.WAFFLE_RND_CONFIG = Object.freeze({environment:'rnd',supabaseUrl:'${PROJECT_URL}',supabaseAnonKey:'${PUBLISHABLE_KEY}'});`,
      'application/javascript; charset=utf-8'
    );
  }

  return response('Not found', 'text/plain; charset=utf-8', 404);
});
