import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { getErrorMessage, parseFormError } from "../api/client";
import type { FormErrors } from "../api/client";
import { leavesApi, leaveTypesApi } from "../api/services";
import { Alert, AsyncBoundary, Field, Modal, Pagination, StatusBadge } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { useDebounce } from "../hooks/useDebounce";
import { fmtDateRange, STATUS_LABELS, STATUS_ORDER, todayISO } from "../lib/format";
import type { LeaveRequest, Notice } from "../types";

type ReviewMode = "approve" | "reject";

function ReviewModal({ request, mode, onClose, onDone }: {
  request: LeaveRequest; mode: ReviewMode; onClose: () => void; onDone: (message: string) => void;
}) {
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<FormErrors | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors(null);
    try {
      if (mode === "approve") await leavesApi.approve(request.id, comment.trim());
      else await leavesApi.reject(request.id, comment.trim());
      onDone(mode === "approve" ? "Request approved." : "Request rejected.");
    } catch (err) {
      setErrors(parseFormError(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={`${mode === "approve" ? "Approve" : "Reject"} request`} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <p>
          <strong>{request.employee_name}</strong> · {request.leave_type_name} ·{" "}
          {fmtDateRange(request.start_date, request.end_date)} ({request.days} day(s))
        </p>
        <p className="muted">“{request.reason}”</p>
        {errors && <Alert>{errors.message}</Alert>}
        <Field
          label={mode === "reject" ? "Reason (required)" : "Comment (optional)"}
          error={errors?.fields.comment}
        >
          <input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={255}
            required={mode === "reject"} autoFocus />
        </Field>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Back</button>
          <button className={`btn ${mode === "approve" ? "btn-primary" : "btn-danger-solid"}`} disabled={busy}>
            {busy ? "Saving…" : mode === "approve" ? "Approve" : "Reject"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function LeaveRequestsPage() {
  const { user, isAdmin } = useAuth();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const [leaveType, setLeaveType] = useState("");
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search);
  const [page, setPage] = useState(1);
  const [review, setReview] = useState<{ request: LeaveRequest; mode: ReviewMode } | null>(null);
  const [notice, setNotice] = useState<Notice | null>(() => {
    const flash = (location.state as { flash?: string } | null)?.flash;
    return flash ? { kind: "success", text: flash } : null;
  });

  const types = useAsync(() => leaveTypesApi.list({ page_size: 100 }), []);
  const { data, loading, error, reload } = useAsync(
    () => leavesApi.list({ status, leave_type: leaveType, search: debounced, page }),
    [status, leaveType, debounced, page],
  );

  function changeStatus(value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set("status", value);
    else next.delete("status");
    setParams(next);
    setPage(1);
  }

  const canCancel = (r: LeaveRequest) =>
    r.employee === user?.id &&
    (r.status === "PENDING" || (r.status === "APPROVED" && r.start_date > todayISO()));
  const canReview = (r: LeaveRequest) => isAdmin && r.status === "PENDING" && r.employee !== user?.id;

  async function cancel(r: LeaveRequest) {
    if (!window.confirm(`Cancel your ${r.leave_type_name} request for ${fmtDateRange(r.start_date, r.end_date)}?`)) return;
    try {
      await leavesApi.cancel(r.id);
      setNotice({ kind: "success", text: "Leave request cancelled." });
      reload();
    } catch (err) {
      setNotice({ kind: "error", text: getErrorMessage(err) });
    }
  }

  const hasFilters = Boolean(status || leaveType || debounced);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{isAdmin ? "Leave requests" : "My leave requests"}</h1>
          <p className="muted">{isAdmin ? "Review and track all requests." : "Track your applications and their status."}</p>
        </div>
        <Link className="btn btn-primary" to="/leaves/new">Apply for leave</Link>
      </div>
      {notice && <Alert kind={notice.kind} onClose={() => setNotice(null)}>{notice.text}</Alert>}

      <div className="toolbar">
        <input type="search" placeholder={isAdmin ? "Search employee or reason…" : "Search reason…"} value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select value={status} onChange={(e) => changeStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select value={leaveType} onChange={(e) => { setLeaveType(e.target.value); setPage(1); }}>
          <option value="">All leave types</option>
          {types.data?.results.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <AsyncBoundary
        loading={loading} error={error} hasData={data !== null}
        onRetry={() => { setPage(1); reload(); }}
        isEmpty={data?.results.length === 0}
        emptyTitle={hasFilters ? "No requests match your filters" : "No leave requests yet"}
        emptyHint={hasFilters ? "Try clearing the search or filters." : "Apply for leave to get started."}
        emptyAction={!hasFilters ? <Link className="btn btn-primary" to="/leaves/new">Apply for leave</Link> : undefined}
      >
        <div className="card table-card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {isAdmin && <th>Employee</th>}
                  <th>Type</th><th>Dates</th><th>Days</th><th>Reason</th><th>Status</th><th>Review</th><th />
                </tr>
              </thead>
              <tbody>
                {data?.results.map((r) => (
                  <tr key={r.id}>
                    {isAdmin && <td>{r.employee_name}</td>}
                    <td>{r.leave_type_name}</td>
                    <td>{fmtDateRange(r.start_date, r.end_date)}</td>
                    <td>{r.days}</td>
                    <td className="cell-wrap">{r.reason}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="cell-wrap">
                      {r.reviewed_by_name ? (
                        <>
                          <small>by {r.reviewed_by_name}</small>
                          {r.review_comment && <><br /><small className="muted">{r.review_comment}</small></>}
                        </>
                      ) : <span className="muted">—</span>}
                    </td>
                    <td>
                      <div className="row-actions">
                        {canReview(r) && (
                          <>
                            <button className="btn btn-sm btn-primary" onClick={() => setReview({ request: r, mode: "approve" })}>Approve</button>
                            <button className="btn btn-sm btn-danger" onClick={() => setReview({ request: r, mode: "reject" })}>Reject</button>
                          </>
                        )}
                        {canCancel(r) && <button className="btn btn-sm" onClick={() => void cancel(r)}>Cancel</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} count={data?.count ?? 0} onChange={setPage} />
        </div>
      </AsyncBoundary>

      {review && (
        <ReviewModal
          request={review.request}
          mode={review.mode}
          onClose={() => setReview(null)}
          onDone={(text) => { setReview(null); setNotice({ kind: "success", text }); reload(); }}
        />
      )}
    </>
  );
}