import { usePaymentMethodsGroupedQuery, useReconciliationQuery } from '../services/api'
import { FiCreditCard, FiLayers } from 'react-icons/fi'

function PaymentsPage() {
  const { data: reconciliation = {} } = useReconciliationQuery()
  const { data: grouped = {} } = usePaymentMethodsGroupedQuery('admin')
  return (
    <section className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
            <FiCreditCard size={16} />
            Reconciliation
          </h3>
          <pre className="max-h-72 overflow-auto rounded bg-slate-100 p-3 text-xs text-slate-700">{JSON.stringify(reconciliation, null, 2)}</pre>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
            <FiLayers size={16} />
            Grouped Payment Methods (admin)
          </h3>
          <pre className="max-h-72 overflow-auto rounded bg-slate-100 p-3 text-xs text-slate-700">{JSON.stringify(grouped, null, 2)}</pre>
        </div>
      </div>
    </section>
  )
}

export default PaymentsPage
