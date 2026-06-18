import { NextRequest, NextResponse } from 'next/server';

/** Allowed image origins to prevent open-proxy abuse */
const ALLOWED_HOSTS = new Set([
  'images.unsplash.com',
  'images.pexels.com',
]);

/** Maximum cached image size (5 MB) */
const MAX_CACHEABLE_SIZE = 5 * 1024 * 1024;

/** Maximum number of cache entries to prevent unbounded memory growth */
const MAX_CACHE_ENTRIES = 200;

/** Cache TTL in ms (24 hours) */
const CACHE_TTL = 24 * 60 * 60 * 1000;

interface CacheEntry {
  body: ArrayBuffer;
  contentType: string;
  etag: string;
  expiresAt: number;
}

/** In-memory LRU-style cache for proxied images (survives across requests in same process) */
const imageCache = new Map<string, CacheEntry>();

/** Periodically prune expired entries (every 10 minutes) */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of imageCache) {
    if (entry.expiresAt < now) imageCache.delete(key);
  }
}, 10 * 60 * 1000);

/**
 * Generate a weak ETag from the URL
 */
function generateETag(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `W/"img-${Math.abs(hash).toString(36)}"`;
}

/**
 * Fetch and cache an upstream image
 */
async function fetchAndCache(url: string): Promise<CacheEntry | null> {
  const cached = imageCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'KitchenImageProxy/1.0' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const contentLength = parseInt(res.headers.get('content-length') || '0', 10);

    const buffer = await res.arrayBuffer();

    // Don't cache very large images — just return them directly
    if (contentLength > MAX_CACHEABLE_SIZE) {
      return { body: buffer, contentType, etag: generateETag(url), expiresAt: 0 };
    }

    const entry: CacheEntry = {
      body: buffer,
      contentType,
      etag: generateETag(url),
      expiresAt: Date.now() + CACHE_TTL,
    };

    // Evict oldest entry if cache is full
    if (imageCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = imageCache.keys().next().value;
      if (oldestKey) imageCache.delete(oldestKey);
    }
    imageCache.set(url, entry);
    return entry;
  } catch {
    return null;
  }
}

/**
 * GET /api/image-proxy?url=<encoded-image-url>
 *
 * Proxies external dish images through our domain, eliminating
 * Cross-Origin Read Blocking (CORB) warnings and CORS issues.
 * Only allows requests to pre-approved image hosts.
 * Uses in-memory caching to avoid repeated upstream requests.
 */
export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get('url');
  if (!urlParam) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(urlParam);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  // Only allow HTTPS to approved hosts
  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) {
    return NextResponse.json({ error: 'Disallowed host' }, { status: 403 });
  }

  const result = await fetchAndCache(target.toString());

  if (!result) {
    return NextResponse.json({ error: 'Upstream fetch failed' }, { status: 502 });
  }

  // Check If-None-Match for conditional requests (304 Not Modified)
  const ifNoneMatch = req.headers.get('if-none-match');
  if (ifNoneMatch === result.etag) {
    return new NextResponse(null, { status: 304 });
  }

  return new NextResponse(result.body, {
    status: 200,
    headers: {
      'Content-Type': result.contentType,
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      'ETag': result.etag,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
