import {
  regionFromCountryCode,
  type AnalyticsGeoRegion,
} from '../src/lib/analytics-geo-region';

export const config = {
  runtime: 'edge',
};

const ANALYTICS_GEO_COOKIE = 'prayerapp.analytics_geo';

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  return headers;
}

function geoCookieValue(region: AnalyticsGeoRegion): string {
  return `${ANALYTICS_GEO_COOKIE}=${region}; Path=/; SameSite=Lax; Secure; Max-Age=86400`;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request),
    });
  }

  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const countryHeader = request.headers.get('x-vercel-ip-country');
  const country =
    countryHeader && countryHeader.length > 0
      ? countryHeader.toUpperCase()
      : null;
  const region = regionFromCountryCode(country);

  const body = JSON.stringify({ region, country });

  const headers = new Headers(corsHeaders(request));
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'private, no-store');
  headers.append('Set-Cookie', geoCookieValue(region));

  return new Response(body, { status: 200, headers });
}
