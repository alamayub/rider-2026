import { listOnlineDriverLocationsByCity } from '../../db/store.js';

export async function findNearestAvailableDriver(cityId, pickup, vehicleTypeId) {
  const onlineDrivers = await listOnlineDriverLocationsByCity(cityId, vehicleTypeId || null);
  if (onlineDrivers.length === 0) return null;

  onlineDrivers.sort((a, b) => {
    const da = Math.hypot(a.lat - pickup.lat, a.lng - pickup.lng);
    const db = Math.hypot(b.lat - pickup.lat, b.lng - pickup.lng);
    return da - db;
  });

  return onlineDrivers[0].driverId;
}
