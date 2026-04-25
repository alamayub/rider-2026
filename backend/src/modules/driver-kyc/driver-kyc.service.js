import { getDriverKycRecord, listDriverKycRecords, upsertDriverKycRecord } from '../../db/store.js';

export async function submitDriverKyc({ driverId, fullName, licenseNumber, documentUrl }) {
  if (!fullName || !licenseNumber) {
    throw new Error('fullName and licenseNumber are required');
  }

  const existing = await getDriverKycRecord(driverId);
  const keepStatus = existing?.status === 'approved' ? 'approved' : 'submitted';

  return upsertDriverKycRecord(
    {
      driverId,
      fullName,
      licenseNumber,
      documentUrl,
      status: keepStatus,
      rejectionReason: null,
      reviewedBy: null,
      reviewedAt: null
    },
    driverId
  );
}

export async function getMyKyc(driverId) {
  return getDriverKycRecord(driverId);
}

export async function listKycForAdmin(status) {
  return listDriverKycRecords(status || null);
}

export async function reviewDriverKyc({ driverId, reviewerAdminId, action, rejectionReason }) {
  const existing = await getDriverKycRecord(driverId);
  if (!existing) {
    throw new Error('KYC record not found');
  }

  if (!['approve', 'reject'].includes(action)) {
    throw new Error('action must be approve or reject');
  }
  if (action === 'reject' && !rejectionReason) {
    throw new Error('rejectionReason is required for reject action');
  }

  return upsertDriverKycRecord(
    {
      driverId,
      fullName: existing.fullName,
      licenseNumber: existing.licenseNumber,
      documentUrl: existing.documentUrl,
      status: action === 'approve' ? 'approved' : 'rejected',
      rejectionReason: action === 'reject' ? rejectionReason : null,
      reviewedBy: reviewerAdminId,
      reviewedAt: new Date().toISOString()
    },
    reviewerAdminId
  );
}
