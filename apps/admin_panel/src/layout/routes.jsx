import DashboardPage from '../pages/DashboardPage'
import CitiesPage from '../pages/CitiesPage'
import VehicleTypesPage from '../pages/VehicleTypesPage'
import CouponsPage from '../pages/CouponsPage'
import OffersPage from '../pages/OffersPage'
import SafetyPage from '../pages/SafetyPage'
import PaymentsPage from '../pages/PaymentsPage'
import PayoutLedgerPage from '../pages/PayoutLedgerPage'
import MessagesPage from '../pages/MessagesPage'
import NotificationsPage from '../pages/NotificationsPage'
import UsersPage from '../pages/UsersPage'
import DriversPage from '../pages/DriversPage'
import { FiBarChart2, FiBell, FiBook, FiCreditCard, FiGift, FiLayers, FiMapPin, FiMessageSquare, FiShield, FiTag, FiTruck, FiUsers } from 'react-icons/fi'

export const appRoutes = [
  { path: '', to: '/', label: 'Dashboard', element: DashboardPage, icon: FiBarChart2, end: true, index: true },
  { path: 'cities', to: '/cities', label: 'Cities', element: CitiesPage, icon: FiMapPin },
  { path: 'vehicle-types', to: '/vehicle-types', label: 'Vehicle types', element: VehicleTypesPage, icon: FiLayers },
  { path: 'offers', to: '/offers', label: 'Offers', element: OffersPage, icon: FiGift },
  { path: 'coupons', to: '/coupons', label: 'Coupons', element: CouponsPage, icon: FiTag },
  { path: 'users', to: '/users', label: 'Users', element: UsersPage, icon: FiUsers },
  { path: 'drivers', to: '/drivers', label: 'Drivers', element: DriversPage, icon: FiTruck },
  { path: 'safety', to: '/safety', label: 'Safety', element: SafetyPage, icon: FiShield },
  { path: 'payments', to: '/payments', label: 'Payments', element: PaymentsPage, icon: FiCreditCard },
  { path: 'ledger', to: '/ledger', label: 'Ledger', element: PayoutLedgerPage, icon: FiBook },
  { path: 'messages', to: '/messages', label: 'Support', element: MessagesPage, icon: FiMessageSquare },
  { path: 'notifications', to: '/notifications', label: 'Notifications', element: NotificationsPage, icon: FiBell },
]
