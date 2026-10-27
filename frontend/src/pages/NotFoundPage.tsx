import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="login-page">
      <div className="card login-card">
        <h1>404</h1>
        <p className="muted">That page does not exist.</p>
        <Link className="btn btn-primary btn-block" to="/">Go to dashboard</Link>
      </div>
    </div>
  );
}