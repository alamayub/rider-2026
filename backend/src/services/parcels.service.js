import {
  createParcelRecord,
  findCityById,
  findParcelById,
  findVehicleTypeById,
  insertParcelEvent,
  listParcelsByUserRole,
  markParcelOtpVerified,
  updateParcelStatusRecord
} from '../db/store.js';
import { findNearestAvailableDriver } from './dispatch.service.js';
import { ensureDriverPayoutAfterParcelDelivered } from './payments.service.js';

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function estimateParcelFare({ cityId, distanceKm, vehicleTypeId, weightKg }) {
  const city = await findCityById(cityId);
  if (!city) throw new Error('Unknown city');

  const vehicleType = vehicleTypeId
    ? await findVehicleTypeById(vehicleTypeId)
    : null;

  if (!vehicleType || !vehicleType.isActive) {
    throw new Error('Vehicle type not found or inactive');
  }

  const weightSurcharge = Math.max(0, Number(weightKg || 0) - 1) * 10;
  const baseAmount = city.baseFare + city.perKm * Number(distanceKm) + weightSurcharge;
  const amount = Math.round(baseAmount * Number(vehicleType.fareMultiplier));

  return {
    cityId: city.id,
    distanceKm: Number(distanceKm),
    weightKg: Number(weightKg || 0),
    vehicleTypeId: vehicleType.id,
    amount
  };
}

export async function createParcel({
  senderUserId,
  cityId,
  pickup,
  drop,
  senderName,
  senderPhone,
  receiverName,
  receiverPhone,
  receiverEmail,
  receiverAddress,
  itemDescription,
  weightKg,
  distanceKm,
  vehicleTypeId
}) {
  const estimate = await estimateParcelFare({ cityId, distanceKm, vehicleTypeId, weightKg });
  const driverId = await findNearestAvailableDriver(estimate.cityId, pickup, estimate.vehicleTypeId);

  const parcel = await createParcelRecord({
    senderUserId,
    driverId,
    cityId: estimate.cityId,
    pickup,
    drop,
    senderName,
    senderPhone,
    receiverName,
    receiverPhone,
    receiverEmail,
    receiverAddress,
    itemDescription,
    weightKg,
    fare: estimate.amount,
    vehicleTypeId: estimate.vehicleTypeId,
    handoffOtp: generateOtp(),
    status: driverId ? 'matched' : 'requested',
    actorUserId: senderUserId
  });

  await insertParcelEvent({ parcelId: parcel.id, type: 'parcel_created', payload: { senderUserId, cityId: estimate.cityId }, actorUserId: senderUserId });
  if (driverId) {
    await insertParcelEvent({ parcelId: parcel.id, type: 'driver_matched', payload: { driverId }, actorUserId: senderUserId });
  }

  return parcel;
}

export async function updateParcelStatus({ parcelId, status, actorUserId, otp }) {
  const existing = await findParcelById(parcelId);
  if (!existing) throw new Error('Parcel not found');

  if (status === 'picked_up') {
    if (!otp) throw new Error('Pickup OTP is required');
    if (String(otp) !== String(existing.handoffOtp)) throw new Error('Invalid pickup OTP');
    await markParcelOtpVerified({ parcelId, otpType: 'pickup', actorUserId });
  }

  if (status === 'delivered') {
    if (!existing.pickupOtpVerifiedAt) throw new Error('Pickup OTP must be verified first');
    if (!otp) throw new Error('Drop OTP is required');
    if (String(otp) !== String(existing.handoffOtp)) throw new Error('Invalid drop OTP');
    await markParcelOtpVerified({ parcelId, otpType: 'drop', actorUserId });
  }

  const parcel = await updateParcelStatusRecord({ parcelId, status, actorUserId });
  if (!parcel) throw new Error('Parcel not found');

  await insertParcelEvent({ parcelId: parcel.id, type: 'status_changed', payload: { status }, actorUserId });
  if (status === 'delivered') {
    await ensureDriverPayoutAfterParcelDelivered({ parcelId: parcel.id, actorUserId });
  }
  return parcel;
}

export async function getParcelById(parcelId) {
  return findParcelById(parcelId);
}

export async function listParcelsByUser(userId, role) {
  return listParcelsByUserRole(userId, role);
}
