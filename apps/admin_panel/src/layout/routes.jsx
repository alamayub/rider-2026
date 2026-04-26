import DashboardPage from '../pages/DashboardPage'
import CitiesPage from '../pages/CitiesPage'
import VehicleTypesPage from '../pages/VehicleTypesPage'
import SafetyPage from '../pages/SafetyPage'
import PaymentsPage from '../pages/PaymentsPage'
import PayoutLedgerPage from '../pages/PayoutLedgerPage'
import MessagesPage from '../pages/MessagesPage'
import NotificationsPage from '../pages/NotificationsPage'
import UsersPage from '../pages/UsersPage'
import DriversPage from '../pages/DriversPage'
import { FiBarChart2, FiBell, FiBook, FiCreditCard, FiLayers, FiMapPin, FiMessageSquare, FiShield, FiTruck, FiUsers } from 'react-icons/fi'

export const appRoutes = [
  { path: '', to: '/', label: 'Dashboard', element: DashboardPage, icon: FiBarChart2, end: true, index: true },
  { path: 'cities', to: '/cities', label: 'Cities', element: CitiesPage, icon: FiMapPin },
  { path: 'vehicle-types', to: '/vehicle-types', label: 'Vehicle types', element: VehicleTypesPage, icon: FiLayers },
  { path: 'users', to: '/users', label: 'Users', element: UsersPage, icon: FiUsers },
  { path: 'drivers', to: '/drivers', label: 'Drivers', element: DriversPage, icon: FiTruck },
  { path: 'safety', to: '/safety', label: 'Safety', element: SafetyPage, icon: FiShield },
  { path: 'payments', to: '/payments', label: 'Payments', element: PaymentsPage, icon: FiCreditCard },
  { path: 'ledger', to: '/ledger', label: 'Ledger', element: PayoutLedgerPage, icon: FiBook },
  { path: 'messages', to: '/messages', label: 'Support', element: MessagesPage, icon: FiMessageSquare },
  { path: 'notifications', to: '/notifications', label: 'Notifications', element: NotificationsPage, icon: FiBell },
]
