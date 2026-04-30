import polyline from '@mapbox/polyline';
import { env } from '../config/env.js';

/** FOSSGIS car profile (recommended over project-osrm.org, which is often 502). */
const OSRM_FALLBACK_BASES = [
  'https://routing.openstreetmap.de/routed-car',
  'https://router.project-osrm.org'
];

function normalizeOsrmBase(url) {
  return String(url || '').trim().replace(/\/$/, '');
}

function assertFinite(name, v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(`Invalid ${name}`);
  }
}

/**
 * OSRM may return GeoJSON (`geometries=geojson`) or, on some stacks, an encoded polyline string.
 * @param {unknown} geometry
 * @returns {unknown[][] | null} GeoJSON-style [lng, lat][] or null
 */
function lineStringCoordinatesFromGeometry(geometry) {
  if (geometry == null) {
    return null;
  }
  if (typeof geometry === 'string') {
    const s = geometry.trim();
    if (!s) return null;
    for (const precision of [5, 6]) {
      try {
        const gj = polyline.toGeoJSON(s, precision);
        if (Array.isArray(gj?.coordinates) && gj.coordinates.length >= 2) {
          return gj.coordinates;
        }
      } catch {
        // try next precision
      }
    }
    return null;
  }
  if (geometry && typeof geometry === 'object' && geometry.type === 'Feature' && geometry.geometry) {
    return lineStringCoordinatesFromGeometry(geometry.geometry);
  }
  if (
    geometry &&
    typeof geometry === 'object' &&
    geometry.type === 'LineString' &&
    Array.isArray(geometry.coordinates)
  ) {
    return geometry.coordinates;
  }
  if (geometry && typeof geometry === 'object' && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates;
  }
  return null;
}

/**
 * @param {unknown} data OSRM route JSON
 * @returns {{ distanceKm: number, points: { lat: number, lng: number }[] }}
 */
export function parseOsrmRouteResponse(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid upstream routing response');
  }

  if (data.code && data.code !== 'Ok') {
    if (data.code === 'NoRoute') {
      throw new Error('No driving route found for these locations');
    }
    throw new Error(`Routing service: ${data.code}`);
  }

  const routes = data.routes;
  if (!Array.isArray(routes) || routes.length === 0) {
    throw new Error('No route returned');
  }

  const route = routes[0];
  const geometry = route?.geometry;
  const coords = lineStringCoordinatesFromGeometry(geometry);
  if (!Array.isArray(coords)) {
    throw new Error('Invalid route geometry');
  }

  /** @type {{ lat: number, lng: number }[]} */
  const points = [];
  for (const c of coords) {
    if (Array.isArray(c) && c.length >= 2) {
      const lng = Number(c[0]);
      const lat = Number(c[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        points.push({ lat, lng });
      }
    }
  }
  if (points.length < 2) {
    throw new Error('Route geometry too short');
  }

  const distM = Number(route.distance);
  if (!Number.isFinite(distM) || distM <= 0) {
    throw new Error('Invalid route distance');
  }

  return {
    distanceKm: distM / 1000,
    points
  };
}

/**
 * @param {string} baseUrl OSRM service root (e.g. …/routed-car or …project-osrm.org)
 * @param {string} coordPath `lng,lat;lng,lat` (no leading slash)
 */
async function fetchOsrmRouteOnce(baseUrl, coordPath) {
  const base = normalizeOsrmBase(baseUrl);
  // Public demo pattern (see https://blog.afi.io/blog/osrm-route-api-free-directions-api-with-turn-by-turn-directions-and-polylines/):
  // `geometries=polyline` → encoded route string (precision 5); add `steps=true` if you need turn-by-turn later.
  const qs = new URLSearchParams({
    overview: 'full',
    geometries: 'polyline',
    generate_hints: 'false'
  });
  const url = `${base}/route/v1/driving/${coordPath}?${qs.toString()}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent':
        'Mozilla/5.0 (compatible; RideAppBackend/1.0; +https://github.com/) routing-preview'
    }
  });
  if (!res.ok) {
    throw new Error(`Upstream routing HTTP ${res.status}`);
  }
  const data = await res.json();
  return parseOsrmRouteResponse(data);
}

function orderedOsrmBases() {
  const primary = normalizeOsrmBase(env.osrmBaseUrl);
  const merged = [primary, ...OSRM_FALLBACK_BASES.map(normalizeOsrmBase)].filter(Boolean);
  return merged.filter((b, i) => merged.indexOf(b) === i);
}

/**
 * @param {{ pickupLat: number, pickupLng: number, dropLat: number, dropLng: number }} p
 * @returns {Promise<{ distanceKm: number, points: { lat: number, lng: number }[] }>}
 */
export async function fetchDrivingRoutePreview(p) {
  const { pickupLat, pickupLng, dropLat, dropLng } = p;
  for (const [k, v] of Object.entries({ pickupLat, pickupLng, dropLat, dropLng })) {
    assertFinite(k, v);
  }
  if (pickupLat < -90 || pickupLat > 90 || dropLat < -90 || dropLat > 90) {
    throw new Error('Latitude out of range');
  }
  if (pickupLng < -180 || pickupLng > 180 || dropLng < -180 || dropLng > 180) {
    throw new Error('Longitude out of range');
  }
  if (
    Math.abs(pickupLat - dropLat) < 1e-7 &&
    Math.abs(pickupLng - dropLng) < 1e-7
  ) {
    throw new Error('Pickup and drop must differ');
  }

  const coordPath = `${pickupLng},${pickupLat};${dropLng},${dropLat}`;
  const bases = orderedOsrmBases();
  /** @type {Error | null} */
  let lastErr = null;
  for (const base of bases) {
    try {
      return await fetchOsrmRouteOnce(base, coordPath);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error('Routing failed');
}
