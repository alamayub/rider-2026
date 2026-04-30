import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchDrivingRoutePreview,
  parseOsrmRouteResponse
} from '../services/routing.service.js';

test('fetchDrivingRoutePreview rejects identical endpoints', async () => {
  await assert.rejects(
    () =>
      fetchDrivingRoutePreview({
        pickupLat: 12.97,
        pickupLng: 77.59,
        dropLat: 12.97,
        dropLng: 77.59
      }),
    /differ/i
  );
});

test('fetchDrivingRoutePreview rejects latitude out of range', async () => {
  await assert.rejects(
    () =>
      fetchDrivingRoutePreview({
        pickupLat: 91,
        pickupLng: 0,
        dropLat: 0,
        dropLng: 1
      }),
    /Latitude/i
  );
});

test('parseOsrmRouteResponse accepts GeoJSON LineString geometry', () => {
  const out = parseOsrmRouteResponse({
    code: 'Ok',
    routes: [
      {
        distance: 2500,
        geometry: {
          type: 'LineString',
          coordinates: [
            [77.59, 12.97],
            [77.6, 12.98]
          ]
        }
      }
    ]
  });
  assert.equal(out.distanceKm, 2.5);
  assert.equal(out.points.length, 2);
  assert.deepEqual(out.points[0], { lat: 12.97, lng: 77.59 });
});

test('parseOsrmRouteResponse accepts encoded polyline string (precision 5)', () => {
  const out = parseOsrmRouteResponse({
    code: 'Ok',
    routes: [
      {
        distance: 100,
        geometry: '_p~iF~ps|U_ulLnnqC_mqNvxq`@'
      }
    ]
  });
  assert.ok(out.points.length >= 2);
  assert.equal(typeof out.distanceKm, 'number');
});

test('parseOsrmRouteResponse rejects OSRM NoRoute code', () => {
  assert.throws(
    () =>
      parseOsrmRouteResponse({
        code: 'NoRoute',
        routes: []
      }),
    /No driving route/i
  );
});
