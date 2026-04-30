const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';

function nominatimHeaders() {
  const userAgent =
    process.env.NOMINATIM_USER_AGENT ||
    'RideApp/1.0 (development; configure NOMINATIM_USER_AGENT for production)';
  return {
    'User-Agent': userAgent,
    Accept: 'application/json'
  };
}

/**
 * Forward geocode via OSM Nominatim (server-side to satisfy usage policy & hide provider).
 * @param {{ query: string, limit?: number }} opts
 * @returns {Promise<{ results: Array<{ label: string, lat: number, lng: number }> }>}
 */
export async function searchPlaces({ query, limit = 8 }) {
  const q = String(query || '').trim();
  if (q.length < 3) {
    return { results: [] };
  }
  const n = Math.min(Math.max(Number(limit) || 8, 1), 15);
  const url = new URL(NOMINATIM_SEARCH);
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', String(n));
  url.searchParams.set('addressdetails', '0');

  const res = await fetch(url.toString(), {
    headers: nominatimHeaders()
  });

  if (!res.ok) {
    throw new Error(`Place search failed (${res.status})`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) {
    return { results: [] };
  }

  const results = data
    .map((row) => {
      const label = row.display_name != null ? String(row.display_name) : '';
      const lat = parseFloat(row.lat);
      const lng = parseFloat(row.lon);
      return { label, lat, lng };
    })
    .filter((r) => r.label.length > 0 && !Number.isNaN(r.lat) && !Number.isNaN(r.lng));

  return { results };
}

/**
 * Reverse geocode (lat/lng → address label) via Nominatim.
 * @param {{ lat: string | number, lng: string | number }} opts
 * @returns {Promise<{ label: string }>}
 */
export async function reversePlace({ lat, lng }) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) {
    throw new Error('Invalid coordinates');
  }
  if (la < -90 || la > 90 || ln < -180 || ln > 180) {
    throw new Error('Invalid coordinates');
  }

  const url = new URL(NOMINATIM_REVERSE);
  url.searchParams.set('lat', String(la));
  url.searchParams.set('lon', String(ln));
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '0');
  url.searchParams.set('zoom', '18');

  const res = await fetch(url.toString(), {
    headers: nominatimHeaders()
  });

  if (!res.ok) {
    throw new Error(`Reverse geocode failed (${res.status})`);
  }

  const data = await res.json();
  if (!data || typeof data !== 'object') {
    return { label: '' };
  }
  if (data.error) {
    return { label: '' };
  }
  const label = data.display_name != null ? String(data.display_name) : '';
  return { label };
}
