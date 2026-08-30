const PREVIEW_URL = 'https://wafflepug.github.io/dog-calendar/rnd-preview/';

// Supabase Edge Functions are API endpoints and rewrite text/html GET responses
// to text/plain. Keep this public endpoint only as a compatibility redirect to
// the actual static R&D preview host. It contains no privileged credentials and
// performs no database operations.
Deno.serve(() => new Response(null, {
  status: 302,
  headers: {
    'Location': PREVIEW_URL,
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Referrer-Policy': 'no-referrer'
  }
}));
