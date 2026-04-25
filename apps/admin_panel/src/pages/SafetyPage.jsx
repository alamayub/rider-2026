import { useState } from 'react'
import { useDriverKycQuery } from '../services/api'
import DataTable from '../components/DataTable'
import { FiShield } from 'react-icons/fi'

function SafetyPage() {
  const [status, setStatus] = useState('')
  const { data: kyc = [], isFetching } = useDriverKycQuery(status)
  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <FiShield size={16} />
          KYC Status Filter
        </label>
        <select className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <p className="mt-2 text-xs text-slate-500">{isFetching ? 'Loading...' : `${kyc.length} records`}</p>
      </div>
      <DataTable title="Driver KYC Queue" rows={kyc} searchableKeys={['driverId', 'status', 'fullName', 'licenseNumber']} />
    </section>
  )
}

export default SafetyPage
