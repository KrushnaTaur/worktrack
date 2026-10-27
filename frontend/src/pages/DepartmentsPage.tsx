import { useState } from "react";
import type { FormEvent } from "react";
import { getErrorMessage, parseFormError } from "../api/client";
import type { FormErrors } from "../api/client";
import { departmentsApi } from "../api/services";
import { Alert, AsyncBoundary, Field, Modal, Pagination } from "../components/ui";
import { useAsync } from "../hooks/useAsync";
import { useDebounce } from "../hooks/useDebounce";
import type { Department, Notice } from "../types";

function DepartmentForm({ department, onClose, onSaved }: {
  department: Department | null; onClose: () => void; onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(department?.name ?? "");
  const [description, setDescription] = useState(department?.description ?? "");
  const [errors, setErrors] = useState<FormErrors | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors(null);
    const payload = { name: name.trim(), description: description.trim() };
    try {
      if (department) await departmentsApi.update(department.id, payload);
      else await departmentsApi.create(payload);
      onSaved(department ? "Department updated." : "Department created.");
    } catch (err) {
      setErrors(parseFormError(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={department ? "Edit department" : "Add department"} onClose={onClose}>
      <form onSubmit={submit} className="form">
        {errors && <Alert>{errors.message}</Alert>}
        <Field label="Name" error={errors?.fields.name}>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoFocus />
        </Field>
        <Field label="Description" error={errors?.fields.description}>
          <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={255} />
        </Field>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function DepartmentsPage() {
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Department | "new" | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const { data, loading, error, reload } = useAsync(
    () => departmentsApi.list({ search: debounced, page }),
    [debounced, page],
  );

  async function remove(dep: Department) {
    if (!window.confirm(`Delete the ${dep.name} department?`)) return;
    try {
      await departmentsApi.remove(dep.id);
      setNotice({ kind: "success", text: "Department deleted." });
      setPage(1);
      reload();
    } catch (err) {
      setNotice({ kind: "error", text: getErrorMessage(err) });
    }
  }

  return (
    <>
      <div className="page-header">
        <div><h1>Departments</h1><p className="muted">A department with employees cannot be deleted.</p></div>
        <button className="btn btn-primary" onClick={() => setEditing("new")}>Add department</button>
      </div>
      {notice && <Alert kind={notice.kind} onClose={() => setNotice(null)}>{notice.text}</Alert>}

      <div className="toolbar">
        <input type="search" placeholder="Search departments…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <AsyncBoundary
        loading={loading} error={error} hasData={data !== null}
        onRetry={() => { setPage(1); reload(); }}
        isEmpty={data?.results.length === 0}
        emptyTitle={debounced ? "No departments match your search" : "No departments yet"}
        emptyHint={debounced ? undefined : "Create one to start adding employees."}
      >
        <div className="card table-card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Description</th><th>Employees</th><th /></tr></thead>
              <tbody>
                {data?.results.map((dep) => (
                  <tr key={dep.id}>
                    <td><strong>{dep.name}</strong></td>
                    <td>{dep.description || <span className="muted">—</span>}</td>
                    <td>{dep.employee_count}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-sm" onClick={() => setEditing(dep)}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => void remove(dep)}>Delete</button>
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

      {editing && (
        <DepartmentForm
          department={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(text) => { setEditing(null); setNotice({ kind: "success", text }); reload(); }}
        />
      )}
    </>
  );
}