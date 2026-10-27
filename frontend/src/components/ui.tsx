import { useEffect } from "react";
import type { ReactNode } from "react";
import { STATUS_LABELS } from "../lib/format";
import type { LeaveStatus } from "../types";

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="center-box" role="status">
      <div className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function Alert({ kind = "error", children, onClose }: {
  kind?: "error" | "success" | "info"; children: ReactNode; onClose?: () => void;
}) {
  return (
    <div className={`alert alert-${kind}`} role={kind === "error" ? "alert" : "status"}>
      <span>{children}</span>
      {onClose && (
        <button type="button" className="alert-close" onClick={onClose} aria-label="Dismiss">×</button>
      )}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="center-box state-box">
      <strong>Something went wrong</strong>
      <p className="muted">{message}</p>
      {onRetry && <button className="btn" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="center-box state-box">
      <strong>{title}</strong>
      {hint && <p className="muted">{hint}</p>}
      {action}
    </div>
  );
}

interface BoundaryProps {
  loading: boolean;
  error: string | null;
  hasData: boolean;
  onRetry: () => void;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  emptyAction?: ReactNode;
  children: ReactNode;
}

/** Shows exactly one of: error, first-load spinner, empty state, or the content. */
export function AsyncBoundary(p: BoundaryProps) {
  if (p.error) return <ErrorState message={p.error} onRetry={p.onRetry} />;
  if (p.loading && !p.hasData) return <Spinner />;
  if (p.isEmpty) {
    return <EmptyState title={p.emptyTitle ?? "Nothing here yet"} hint={p.emptyHint} action={p.emptyAction} />;
  }
  return <div className={p.loading ? "dim" : undefined}>{p.children}</div>;
}

export function StatusBadge({ status }: { status: LeaveStatus }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{STATUS_LABELS[status]}</span>;
}

export function Pagination({ page, count, pageSize = 10, onChange }: {
  page: number; count: number; pageSize?: number; onChange: (page: number) => void;
}) {
  if (count === 0) return null;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count);
  return (
    <div className="pagination">
      <span className="muted">Showing {from}–{to} of {count}</span>
      <div className="row-actions">
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
        <span>Page {page} of {totalPages}</span>
        <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next</button>
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, error, hint, children }: {
  label: string; error?: string; hint?: string; children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && <small className="muted">{hint}</small>}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}