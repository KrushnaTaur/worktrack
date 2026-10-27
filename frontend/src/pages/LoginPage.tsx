import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getErrorMessage } from "../api/client";
import { Alert, Field } from "../components/ui";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (user) return <Navigate to={from} replace />;

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={onSubmit}>
        <h1>WorkTrack</h1>
        <p className="muted">Employee and leave management</p>
        {error && <Alert>{error}</Alert>}
        <Field label="Username">
          <input value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus autoComplete="username" />
        </Field>
        <Field label="Password">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </Field>
        <button className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
        {import.meta.env.DEV && (
          <div className="demo-box">
            <strong>Demo accounts (from seed_demo)</strong>
            <span>Admin: demo_admin / Admin@12345</span>
            <span>Employee: alice / Employee@123</span>
          </div>
        )}
      </form>
    </div>
  );
}