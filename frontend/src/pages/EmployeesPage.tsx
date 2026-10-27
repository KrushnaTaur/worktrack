import { useState } from "react";
import { getErrorMessage } from "../api/client";
import { departmentsApi, employeesApi } from "../api/services";
import { EmployeeForm } from "../components/EmployeeForm";
import { Alert, AsyncBoundary, Pagination } from "../components/ui";
import { useAsync } from "../hooks/useAsync";
import { useDebounce } from "../hooks/useDebounce";
import { fmtDate } from "../lib/format";
import type { Employee, Notice } from "../types";

export default function EmployeesPage() {
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search);
  const [department, setDepartment] = useState("");
  const [active, setActive] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Employee | "new" | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const departments = useAsync(() => departmentsApi.list({ page_size: 100 }), []);
  const { data, loading, error, reload } = useAsync(
    () => employeesApi.list({ search: debounced, department, is_active: active, page }),
    [debounced, department, active, page],
  );

  const hasFilters = Boolean(debounced || department || active);
  const noDepartments = departments.data?.count === 0;

  async function toggleActive(emp: Employee) {
    const verb = emp.is_active ? "Deactivate" : "Reactivate";
    if (!window.confirm(`${verb} ${emp.full_name}?${emp.is_active ? " They will no longer be able to log in." : ""}`)) return;
    try {
      if (emp.is_active) await employeesApi.remove(emp.id);
      else await employeesApi.update(emp.id, { is_active: true });
      setNotice({ kind: "success", text: `${emp.full_name} ${emp.is_active ? "deactivated" : "reactivated"}.` });
      reload();
    } catch (err) {
      setNotice({ kind: "error", text: getErrorMessage(err) });
    }
  }

  return (
    <>
      <div className="page-header">
        <div><h1>Employees</h1><p className="muted">Manage profiles and accounts.</p></div>
        <button className="btn btn-primary" disabled={noDepartments || !departments.data} onClick={() => setEditing("new")}>
          Add employee
        </button>
      </div>

      {noDepartments && <Alert kind="info">Create a department first, then you can add employees.</Alert>}
      {notice && <Alert kind={notice.kind} onClose={() => setNotice(null)}>{notice.text}</Alert>}

      <div className="toolbar">
        <input
          type="search" placeholder="Search name, email, code, title…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select value={department} onChange={(e) => { setDepartment(e.target.value); setPage(1); }}>
          <option value="">All departments</option>
          {departments.data?.results.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={active} onChange={(e) => { setActive(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      <AsyncBoundary
        loading={loading} error={error} hasData={data !== null}
        onRetry={() => { setPage(1); reload(); }}
        isEmpty={data?.results.length === 0}
        emptyTitle={hasFilters ? "No employees match your filters" : "No employees yet"}
        emptyHint={hasFilters ? "Try clearing the search or filters." : "Add your first employee to get started."}
      >
        <div className="card table-card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Code</th><th>Name</th><th>Department</th><th>Job title</th><th>Joined</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {data?.results.map((emp) => (
                  <tr key={emp.id}>
                    <td>{emp.employee_code}</td>
                    <td><strong>{emp.full_name}</strong><br /><small className="muted">{emp.email}</small></td>
                    <td>{emp.department_name}</td>
                    <td>{emp.job_title}</td>
                    <td>{fmtDate(emp.joined_on)}</td>
                    <td>
                      <span className={`badge ${emp.is_active ? "badge-active" : "badge-inactive"}`}>
                        {emp.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-sm" onClick={() => setEditing(emp)}>Edit</button>
                        <button className={`btn btn-sm ${emp.is_active ? "btn-danger" : ""}`} onClick={() => void toggleActive(emp)}>
                          {emp.is_active ? "Deactivate" : "Reactivate"}
                        </button>
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

      {editing && departments.data && (
        <EmployeeForm
          employee={editing === "new" ? null : editing}
          departments={departments.data.results}
          onClose={() => setEditing(null)}
          onSaved={(text) => { setEditing(null); setNotice({ kind: "success", text }); reload(); }}
        />
      )}
    </>
  );
}