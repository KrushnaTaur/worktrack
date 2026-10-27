import type { LeaveBalance } from "../types";

export function BalanceCard({ balance: b }: { balance: LeaveBalance }) {
  const pct = b.total_days ? Math.min(100, (b.used_days / b.total_days) * 100) : 0;
  return (
    <div className="card balance-card">
      <div className="balance-head">
        <strong>{b.leave_type_name}</strong>
        <span className="muted">{b.year}</span>
      </div>
      <div className="balance-num">
        {b.remaining_days}
        <small> of {b.total_days} days left</small>
      </div>
      <div className="bar-track"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
      <small className="muted">{b.used_days} used</small>
    </div>
  );
}