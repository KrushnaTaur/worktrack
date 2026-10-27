import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface NavItem { to: string; label: string; end?: boolean; adminOnly?: boolean }

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/leaves", label: "Leave requests", end: true },
  { to: "/leaves/new", label: "Apply for leave" },
  { to: "/balances", label: "Leave balances" },
  { to: "/employees", label: "Employees", adminOnly: true },
  { to: "/departments", label: "Departments", adminOnly: true },
  { to: "/profile", label: "My profile" },
];

export function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="app-shell">
      <aside className={`sidebar${open ? " open" : ""}`}>
        <div className="brand">WorkTrack</div>
        <nav>
          {NAV.filter((item) => !item.adminOnly || isAdmin).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">☰</button>
          <div className="spacer" />
          <div className="user-chip">
            <strong>{user?.full_name}</strong>
            <span className="badge badge-role">{isAdmin ? "Admin" : "Employee"}</span>
          </div>
          <button className="btn btn-sm" onClick={() => void logout()}>Log out</button>
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  );
}