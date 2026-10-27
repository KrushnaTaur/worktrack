import { Link } from "react-router-dom";
import { dashboardApi } from "../api/services";
import { BalanceCard } from "../components/BalanceCard";
import { AsyncBoundary } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { fmtDateRange, STATUS_LABELS, STATUS_ORDER } from "../lib/format";
import type { AdminDashboard, EmployeeDashboard, StatusCounts, TrendPoint } from "../types";

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString("en-US", { month: "short" });
}

function BarList({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="bar-list">
      {items.map((i) => (
        <li key={i.label}>
          <span>{i.label}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(i.value / max) * 100}%` }} /></div>
          <strong>{i.value}</strong>
        </li>
      ))}
    </ul>
  );
}

function TrendChart({ data }: { data: TrendPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="trend" role="img" aria-label="Leave requests per month">
      {data.map((d) => (
        <div className="trend-col" key={d.month}>
          <span className="trend-value">{d.count}</span>
          <div className="trend-track">
            <div className="trend-bar" style={{ height: `${(d.count / max) * 100}%` }} />
          </div>
          <span className="trend-label">{monthLabel(d.month)}</span>
        </div>
      ))}
    </div>
  );
}

const statusItems = (counts: StatusCounts) =>
  STATUS_ORDER.map((s) => ({ label: STATUS_LABELS[s], value: counts[s] }));

function AdminView({ d }: { d: AdminDashboard }) {
  const stats = [
    { label: "Active employees", value: d.totals.employees },
    { label: "Departments", value: d.totals.departments },
    { label: "Pending requests", value: d.totals.pending_requests },
    { label: "On leave today", value: d.totals.on_leave_today },
  ];
  return (
    <>
      <div className="grid grid-4">
        {stats.map((s) => (
          <div className="card stat" key={s.label}>
            <span className="muted">{s.label}</span>
            <strong>{s.value}</strong>
          </div>
        ))}
      </div>
      <div className="grid grid-2">
        <section className="card"><h2>Requests by start month</h2><TrendChart data={d.monthly_trend} /></section>
        <section className="card"><h2>Requests by status</h2><BarList items={statusItems(d.requests_by_status)} /></section>
      </div>
      <div className="grid grid-2">
        <section className="card">
          <h2>Requests by type</h2>
          {d.requests_by_type.length
            ? <BarList items={d.requests_by_type.map((t) => ({ label: t.name, value: t.count }))} />
            : <p className="muted">No requests yet.</p>}
        </section>
        <section className="card">
          <div className="card-head">
            <h2>Awaiting review</h2>
            <Link to="/leaves?status=PENDING">View all</Link>
          </div>
          {d.recent_pending.length ? (
            <ul className="list">
              {d.recent_pending.map((r) => (
                <li key={r.id}>
                  <strong>{r.employee_name}</strong>
                  <span>{r.leave_type_name} · {r.days} day(s)</span>
                  <small className="muted">{fmtDateRange(r.start_date, r.end_date)}</small>
                </li>
              ))}
            </ul>
          ) : <p className="muted">Nothing is waiting for review.</p>}
        </section>
      </div>
    </>
  );
}

function EmployeeView({ d }: { d: EmployeeDashboard }) {
  return (
    <>
      <div className="grid grid-3">
        {d.balances.map((b) => <BalanceCard key={b.id} balance={b} />)}
      </div>
      <div className="grid grid-2">
        <section className="card"><h2>My requests by status</h2><BarList items={statusItems(d.requests_by_status)} /></section>
        <section className="card"><h2>My requests by start month</h2><TrendChart data={d.monthly_trend} /></section>
      </div>
      <section className="card">
        <h2>Upcoming approved leave</h2>
        {d.upcoming_leaves.length ? (
          <ul className="list">
            {d.upcoming_leaves.map((r) => (
              <li key={r.id}>
                <strong>{r.leave_type_name}</strong>
                <span>{fmtDateRange(r.start_date, r.end_date)}</span>
                <small className="muted">{r.days} working day(s)</small>
              </li>
            ))}
          </ul>
        ) : <p className="muted">No upcoming approved leave.</p>}
      </section>
    </>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => dashboardApi.get(), []);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Welcome back, {user?.first_name || user?.username}</h1>
          <p className="muted">Here is your leave overview.</p>
        </div>
        <Link className="btn btn-primary" to="/leaves/new">Apply for leave</Link>
      </div>
      <AsyncBoundary loading={loading} error={error} hasData={data !== null} onRetry={reload}>
        {data && (data.role === "ADMIN" ? <AdminView d={data} /> : <EmployeeView d={data} />)}
      </AsyncBoundary>
    </>
  );
}