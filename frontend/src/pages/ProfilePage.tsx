import { useState } from "react";
import type { FormEvent } from "react";
import { parseFormError } from "../api/client";
import type { FormErrors } from "../api/client";
import { authApi, employeesApi } from "../api/services";
import { Alert, AsyncBoundary, Field } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { fmtDate } from "../lib/format";
import type { Employee } from "../types";

function ChangePasswordForm() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FormErrors | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSuccess(false);
    if (newPassword !== confirm) {
      setErrors({ message: "Please fix the highlighted fields.", fields: { confirm: "Passwords do not match." } });
      return;
    }
    setBusy(true);
    setErrors(null);
    try {
      await authApi.changePassword(oldPassword, newPassword);
      setSuccess(true);
      setOldPassword(""); setNewPassword(""); setConfirm("");
    } catch (err) {
      setErrors(parseFormError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form form-narrow" onSubmit={submit}>
      <h2>Change password</h2>
      {errors && <Alert>{errors.message}</Alert>}
      {success && <Alert kind="success">Password updated.</Alert>}
      <Field label="Current password" error={errors?.fields.old_password}>
        <input type="password" autoComplete="current-password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
      </Field>
      <Field label="New password" error={errors?.fields.new_password}>
        <input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
      </Field>
      <Field label="Confirm new password" error={errors?.fields.confirm}>
        <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </Field>
      <div className="modal-actions">
        <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Update password"}</button>
      </div>
    </form>
  );
}

export default function ProfilePage() {
  const { user, isAdmin } = useAuth();
  // Admin accounts created with createsuperuser have no employee profile.
  const profile = useAsync<Employee | null>(
    () => (isAdmin ? Promise.resolve(null) : employeesApi.me()),
    [isAdmin],
  );
  const p = profile.data;

  return (
    <>
      <div className="page-header"><div><h1>My profile</h1></div></div>
      <AsyncBoundary loading={profile.loading} error={profile.error} hasData={profile.data !== null || isAdmin} onRetry={profile.reload}>
        <section className="card">
          <h2>{user?.full_name}</h2>
          <dl className="details">
            <dt>Username</dt><dd>{user?.username}</dd>
            <dt>Email</dt><dd>{user?.email}</dd>
            <dt>Role</dt><dd>{isAdmin ? "Admin" : "Employee"}</dd>
            {p && (
              <>
                <dt>Employee code</dt><dd>{p.employee_code}</dd>
                <dt>Department</dt><dd>{p.department_name}</dd>
                <dt>Job title</dt><dd>{p.job_title}</dd>
                <dt>Phone</dt><dd>{p.phone || "—"}</dd>
                <dt>Joined</dt><dd>{fmtDate(p.joined_on)}</dd>
              </>
            )}
          </dl>
          {isAdmin && <p className="muted">Admin accounts do not have an employee profile.</p>}
        </section>
      </AsyncBoundary>
      <ChangePasswordForm />
    </>
  );
}