import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { parseFormError } from "../api/client";
import type { FormErrors } from "../api/client";
import { balancesApi, leavesApi, leaveTypesApi } from "../api/services";
import { Alert, AsyncBoundary, Field } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { countWorkingDays, todayISO } from "../lib/format";

export default function ApplyLeavePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<FormErrors | null>(null);
  const [busy, setBusy] = useState(false);

  const types = useAsync(() => leaveTypesApi.list({ page_size: 100 }), []);
  const balances = useAsync(
    () => balancesApi.list({ user: user?.id, page_size: 100 }),
    [user?.id],
  );

  const year = startDate ? Number(startDate.slice(0, 4)) : new Date().getFullYear();
  const selected = balances.data?.results.find((b) => b.leave_type === Number(leaveType) && b.year === year);
  const workingDays = countWorkingDays(startDate, endDate);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors(null);
    try {
      await leavesApi.create({
        leave_type: Number(leaveType),
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim(),
      });
      navigate("/leaves", { state: { flash: "Leave request submitted." } });
    } catch (err) {
      setErrors(parseFormError(err));
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div><h1>Apply for leave</h1><p className="muted">Weekends are not counted. Pending requests reserve your balance.</p></div>
      </div>

      <AsyncBoundary loading={types.loading} error={types.error} hasData={types.data !== null} onRetry={types.reload}>
        <form className="card form form-narrow" onSubmit={submit}>
          {errors && <Alert>{errors.message}</Alert>}
          <Field
            label="Leave type"
            error={errors?.fields.leave_type}
            hint={selected ? `${selected.remaining_days} of ${selected.total_days} days left in ${selected.year}` : undefined}
          >
            <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} required>
              <option value="">Select…</option>
              {types.data?.results.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <div className="form-grid">
            <Field label="Start date" error={errors?.fields.start_date}>
              <input type="date" value={startDate} min={todayISO()} required
                onChange={(e) => { setStartDate(e.target.value); if (!endDate || endDate < e.target.value) setEndDate(e.target.value); }} />
            </Field>
            <Field label="End date" error={errors?.fields.end_date}>
              <input type="date" value={endDate} min={startDate || todayISO()} required
                onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>
          {startDate && endDate && (
            <p className="muted">≈ {workingDays} working day(s) will be requested.</p>
          )}
          <Field label="Reason" error={errors?.fields.reason}>
            <textarea rows={3} value={reason} maxLength={500} required onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="modal-actions">
            <Link className="btn" to="/leaves">Cancel</Link>
            <button className="btn btn-primary" disabled={busy}>{busy ? "Submitting…" : "Submit request"}</button>
          </div>
        </form>
      </AsyncBoundary>
    </>
  );
}