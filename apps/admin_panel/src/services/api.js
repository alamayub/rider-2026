import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { clearAuth } from '../store/authSlice'

const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'
const rawBaseQuery = fetchBaseQuery({
  baseUrl,
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth?.accessToken
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
    return headers
  },
})

const baseQuery = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions)
  if (result?.error?.status === 401) {
    api.dispatch(clearAuth())
  }
  return result
}

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Notifications', 'NotificationStats', 'GlobalNotificationStats', 'Conversations', 'Messages'],
  endpoints: (builder) => ({
    health: builder.query({
      query: () => '/health',
    }),
    signIn: builder.mutation({
      query: ({ phone, password, role = 'admin' }) => ({
        url: '/auth/signin',
        method: 'POST',
        body: { phone, password, role },
      }),
    }),
    adminAnalytics: builder.query({
      query: () => '/analytics/admin',
    }),
    liveRides: builder.query({
      query: () => '/admin/rides/live',
    }),
    reports: builder.query({
      query: () => '/admin/reports',
    }),
    adminUsers: builder.query({
      query: ({ role = '', status = '', limit = 200 } = {}) =>
        `/admin/users?role=${encodeURIComponent(role)}&status=${encodeURIComponent(status)}&limit=${limit}`,
    }),
    adminSearchUsers: builder.query({
      query: ({ q, role = '', status = '', limit = 25 }) =>
        `/admin/users/search?q=${encodeURIComponent(q)}&role=${encodeURIComponent(role)}&status=${encodeURIComponent(status)}&limit=${limit}`,
    }),
    updateUserStatus: builder.mutation({
      query: ({ userId, status, reason }) => ({
        url: `/admin/users/${userId}/status`,
        method: 'POST',
        body: { status, reason },
      }),
    }),
    userAccountActions: builder.query({
      query: ({ userId, limit = 100 }) => `/admin/users/${userId}/account-actions?limit=${limit}`,
    }),
    driverKyc: builder.query({
      query: (status = '') => `/driver-kyc/admin${status ? `?status=${encodeURIComponent(status)}` : ''}`,
    }),
    reconciliation: builder.query({
      query: () => '/payments/admin/reconciliation',
    }),
    payoutLedger: builder.query({
      query: ({ driverId, status, limit } = {}) => {
        const q = new URLSearchParams()
        if (driverId) q.set('driverId', driverId)
        if (status) q.set('status', status)
        if (limit != null && limit !== '') q.set('limit', String(limit))
        const qs = q.toString()
        return `/payments/admin/payout-ledger${qs ? `?${qs}` : ''}`
      },
    }),
    paymentMethodsGrouped: builder.query({
      query: (app = 'admin') => `/payments/methods/grouped?app=${encodeURIComponent(app)}&country=np&currency=NPR`,
    }),
    myNotifications: builder.query({
      query: (limit = 200) => `/notifications/me?limit=${limit}`,
      providesTags: [{ type: 'Notifications', id: 'LIST' }],
    }),
    myNotificationStats: builder.query({
      query: () => '/notifications/me/stats',
      providesTags: [{ type: 'NotificationStats', id: 'ME' }],
    }),
    adminGlobalNotificationStats: builder.query({
      query: () => '/notifications/admin/stats',
      providesTags: [{ type: 'GlobalNotificationStats', id: 'GLOBAL' }],
    }),
    adminSendNotification: builder.mutation({
      query: (body) => ({
        url: '/notifications/admin/send',
        method: 'POST',
        body,
      }),
      invalidatesTags: () => [
        { type: 'Notifications', id: 'LIST' },
        { type: 'NotificationStats', id: 'ME' },
        { type: 'GlobalNotificationStats', id: 'GLOBAL' },
      ],
    }),
    markNotificationReceived: builder.mutation({
      query: (notificationId) => ({
        url: `/notifications/${notificationId}/received`,
        method: 'POST',
      }),
      invalidatesTags: () => [
        { type: 'Notifications', id: 'LIST' },
        { type: 'NotificationStats', id: 'ME' },
        { type: 'GlobalNotificationStats', id: 'GLOBAL' },
      ],
    }),
    markNotificationDelivered: builder.mutation({
      query: (notificationId) => ({
        url: `/notifications/${notificationId}/delivered`,
        method: 'POST',
      }),
      invalidatesTags: () => [
        { type: 'Notifications', id: 'LIST' },
        { type: 'NotificationStats', id: 'ME' },
        { type: 'GlobalNotificationStats', id: 'GLOBAL' },
      ],
    }),
    markNotificationRead: builder.mutation({
      query: (notificationId) => ({
        url: `/notifications/${notificationId}/read`,
        method: 'POST',
      }),
      invalidatesTags: () => [
        { type: 'Notifications', id: 'LIST' },
        { type: 'NotificationStats', id: 'ME' },
        { type: 'GlobalNotificationStats', id: 'GLOBAL' },
      ],
    }),
    conversations: builder.query({
      query: () => '/messages/conversations',
      providesTags: [{ type: 'Conversations', id: 'LIST' }],
    }),
    messages: builder.query({
      query: (conversationId) => `/messages/conversations/${conversationId}/messages`,
      providesTags: (_result, _err, conversationId) => [{ type: 'Messages', id: String(conversationId) }],
    }),
    sendMessage: builder.mutation({
      query: ({ conversationId, content }) => ({
        url: `/messages/conversations/${conversationId}/messages`,
        method: 'POST',
        body: { content },
      }),
      invalidatesTags: (_result, _err, { conversationId }) => [
        { type: 'Messages', id: String(conversationId) },
        { type: 'Conversations', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useHealthQuery,
  useSignInMutation,
  useLazyAdminAnalyticsQuery,
  useLazyLiveRidesQuery,
  useLazyReportsQuery,
  useAdminUsersQuery,
  useAdminSearchUsersQuery,
  useUpdateUserStatusMutation,
  useUserAccountActionsQuery,
  useDriverKycQuery,
  useReconciliationQuery,
  usePayoutLedgerQuery,
  usePaymentMethodsGroupedQuery,
  useMyNotificationsQuery,
  useMyNotificationStatsQuery,
  useAdminGlobalNotificationStatsQuery,
  useAdminSendNotificationMutation,
  useMarkNotificationReceivedMutation,
  useMarkNotificationDeliveredMutation,
  useMarkNotificationReadMutation,
  useConversationsQuery,
  useMessagesQuery,
  useSendMessageMutation,
} = api
