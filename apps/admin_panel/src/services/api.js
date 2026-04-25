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
    paymentMethodsGrouped: builder.query({
      query: (app = 'admin') => `/payments/methods/grouped?app=${encodeURIComponent(app)}&country=np&currency=NPR`,
    }),
    myNotifications: builder.query({
      query: () => '/notifications/me?limit=100',
    }),
    myNotificationStats: builder.query({
      query: () => '/notifications/me/stats',
    }),
    conversations: builder.query({
      query: () => '/messages/conversations',
    }),
    messages: builder.query({
      query: (conversationId) => `/messages/conversations/${conversationId}/messages`,
    }),
    sendMessage: builder.mutation({
      query: ({ conversationId, content }) => ({
        url: `/messages/conversations/${conversationId}/messages`,
        method: 'POST',
        body: { content },
      }),
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
  useUpdateUserStatusMutation,
  useUserAccountActionsQuery,
  useDriverKycQuery,
  useReconciliationQuery,
  usePaymentMethodsGroupedQuery,
  useMyNotificationsQuery,
  useMyNotificationStatsQuery,
  useConversationsQuery,
  useMessagesQuery,
  useSendMessageMutation,
} = api
