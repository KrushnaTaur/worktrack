import { useState } from "react";
import type { FormEvent } from "react";
import { parseFormError } from "../api/client";
import type { FormErrors } from "../api/client";
import { balancesApi, employeesApi } from "../api/services";
import { BalanceCard } from "../components/BalanceCard";
import { Alert, AsyncBoundary, Field, Modal, Pagination } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useAsync } from "../hooks/useAsync";
import type { LeaveBalance, Notice } from "../types";

function MyBalances({ userId }: { userId: number }) {
  const { data, loading, error, reload } = useAsync(
    () => balancesApi.list({ user: userId, page_size: 100 }),
    [userId],
  );
  return (
    <AsyncBoundary
      loading={loading} error={error} hasData={data !== null} onRetry={reload}
      isEmpty={data?.results.length === 0} emptyTitle="No balances yet"
      emptyHint="Balances are created when you open the dashboard or apply for leave."
    >
      <div className="grid grid-3">
        {data?.results.map((b) => <BalanceCard key={b.id} balance={b} />)}
      </div>
    </AsyncBoundary>
  );
}

function AdjustModal({ balance, onClose, onSaved }: {
  balance: LeaveBalance; onClose: () => void; onSaved: (message: string) => void;
}) {
  const [total, setTotal] = useState(String(balance.total_days));
  const [errors, setErrors] = useState<FormErrors | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors(null);
    try {
      await balancesApi.update(balance.id, Number(total));
      onSaved("Balance updated.");
    } catch (err) {
      setErrors(parseFormError(err));
      setBusy(false);
    }
  }

  return (
    <Modal title="Adjust balance" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p>{balance.user_name} · {balance.leave_type_name} · {balance.year} ({balance.used_days} used)</p>
        {errors && <Alert>{errors.message}</Alert>}
        <Field label="Total days" error={errors?.fields.total_days}>
          <input type="number" min={balance.used_days} max={365} value={total}
            onChange={(e) => setTotal(e.target.value)} required autoFocus />
        </Field>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}

function AllBalances() {
  const thisYear = new Date().getFullYear();
  const [userId, setUserId] = useState("");
  const [year, setYear] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<LeaveBalance | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const employees = useAsync(() => employeesApi.list({ page_size: 100, ordering: "user__first_name" }), []);
  const { data, loading, error, reload } = useAsync(
    () => balancesApi.list({ user: userId, year, page }),
    [userId, year, page],
  );

  return (
    <>
      {notice && <Alert kind={notice.kind} onClose={() => setNotice(null)}>{notice.text}</Alert>}
      <div className="toolbar">
        <select value={userId} onChange={(e) => { setUserId(e.target.value); setPage(1); }}>
          <option value="">All employees</option>
          {employees.data?.results.map((emp) => <option key={emp.id} value={emp.user_id}>{emp.full_name}</option>)}
        </select>
        <select value={year} onChange={(e) => { setYear(e.target.value); setPage(1); }}>
          <option value="">All years</option>
          {[thisYear - 1, thisYear, thisYear + 1].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <AsyncBoundary
        loading={loading} error={error} hasData={data !== null}
        onRetry={() => { setPage(1); reload(); }}
        isEmpty={data?.results.length === 0} emptyTitle="No balances found"
        emptyHint="Pick an employee to create their current-year balances."
      >
        <div className="card table-card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Type</th><th>Year</th><th>Total</th><th>Used</th><th>Remaining</th><th /></tr></thead>
              <tbody>
                {data?.results.map((b) => (
                  <tr key={b.id}>
                    <td>{b.user_name}</td><td>{b.leave_type_name}</td><td>{b.year}</td>
                    <td>{b.total_days}</td><td>{b.used_days}</td><td><strong>{b.remaining_days}</strong></td>
                    <td><button className="btn btn-sm" onClick={() => setEditing(b)}>Adjust</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} count={data?.count ?? 0} onChange={setPage} />
        </div>
      </AsyncBoundary>
      {editing && (
        <AdjustModal
          balance={editing}
          onClose={() => setEditing(null)}
          onSaved={(text) => { setEditing(null); setNotice({ kind: "success", text }); reload(); }}
        />
      )}
    </>
  );
}

export default function BalancesPage() {
  const { user, isAdmin } = useAuth();
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Leave balances</h1>
          <p className="muted">{isAdmin ? "View and adjust employee entitlements." : "Your remaining leave this year."}</p>
        </div>
      </div>
      {isAdmin ? <AllBalances /> : user && <MyBalances userId={user.id} />}
    </>
  );
}