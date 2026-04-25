import {
  countOpenReportsAgainstUser,
  createAccountActionRecord,
  createReportRecord,
  findUserById,
  updateUserStatus,
  listReportsByReporter
} from '../db/store.js';

const SUSPEND_THRESHOLD = 3;
const BAN_THRESHOLD = 5;

export async function submitReport({ rideId, reporterUserId, reportedUserId, reason, description }) {
  if (reporterUserId === reportedUserId) {
    throw new Error('Cannot report your own account');
  }

  const reportedUser = await findUserById(reportedUserId);
  if (!reportedUser) {
    throw new Error('Reported user not found');
  }

  const report = await createReportRecord({
    rideId,
    reporterUserId,
    reportedUserId,
    reason,
    description,
    actorUserId: reporterUserId
  });

  const openReportCount = await countOpenReportsAgainstUser(reportedUserId);

  if (openReportCount >= BAN_THRESHOLD && reportedUser.status !== 'banned') {
    await updateUserStatus(reportedUserId, 'banned');
    await createAccountActionRecord({
      userId: reportedUserId,
      action: 'ban',
      source: 'auto_report_threshold',
      metadata: { openReportCount, threshold: BAN_THRESHOLD, reportId: report.id },
      actorUserId: 'system'
    });
  } else if (openReportCount >= SUSPEND_THRESHOLD && reportedUser.status === 'active') {
    await updateUserStatus(reportedUserId, 'suspended');
    await createAccountActionRecord({
      userId: reportedUserId,
      action: 'suspend',
      source: 'auto_report_threshold',
      metadata: { openReportCount, threshold: SUSPEND_THRESHOLD, reportId: report.id },
      actorUserId: 'system'
    });
  }

  return {
    report,
    moderation: {
      openReportCount,
      suspendThreshold: SUSPEND_THRESHOLD,
      banThreshold: BAN_THRESHOLD
    }
  };
}

export async function listMyReports(userId) {
  return listReportsByReporter(userId);
}
