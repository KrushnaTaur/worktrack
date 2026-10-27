import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { parseFormError } from "../api/client";
import type { FormErrors } from "../api/client";
import { employeesApi } from "../api/services";
import { todayISO } from "../lib/format";
import type { Department, Employee, EmployeeInput } from "../types";
import { Alert, Field, Modal } from "./ui";

interface Props {
  employee: Employee | null; // null = create
  departments: Department[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function EmployeeForm({ employee, departments, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    username: employee?.username ?? "",
    email: employee?.email ?? "",
    first_name: employee?.first_name ?? "",
    last_name: employee?.last_name ?? "",
    password: "",
    department: employee ? String(employee.department) : "",
    employee_code: employee?.employee_code ?? "",
    job_title: employee?.job_title ?? "",
    phone: employee?.phone ?? "",
    joined_on: employee?.joined_on ?? "",
    is_active: employee?.is_active ?? true,
  });
  const [errors, setErrors] = useState<FormErrors | null>(null);
  const [busy, setBusy] = useState(false);

  const bind = (key: Exclude<keyof typeof form, "is_active">) => ({
    value: form[key],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });
  const err = (key: string) => errors?.fields[key];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors(null);
    const payload: EmployeeInput = {
      username: form.username.trim(),
      email: form.email.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      department: Number(form.department),
      employee_code: form.employee_code.trim(),
      job_title: form.job_title.trim(),
      phone: form.phone.trim(),
      joined_on: form.joined_on,
      ...(form.password ? { password: form.password } : {}),
      ...(employee ? { is_active: form.is_active } : {}),
    };
    try {
      if (employee) await employeesApi.update(employee.id, payload);
      else await employeesApi.create(payload);
      onSaved(employee ? "Employee updated." : "Employee created.");
    } catch (error) {
      setErrors(parseFormError(error));
      setBusy(false);
    }
  }

  return (
    <Modal title={employee ? `Edit ${employee.full_name}` : "Add employee"} onClose={onClose}>
      <form onSubmit={submit} className="form">
        {errors && <Alert>{errors.message}</Alert>}
        <div className="form-grid">
          <Field label="First name" error={err("first_name")}><input required maxLength={150} {...bind("first_name")} /></Field>
          <Field label="Last name" error={err("last_name")}><input required maxLength={150} {...bind("last_name")} /></Field>
          <Field label="Username" error={err("username")}><input required maxLength={150} autoComplete="off" {...bind("username")} /></Field>
          <Field label="Email" error={err("email")}><input type="email" required {...bind("email")} /></Field>
          <Field
            label={employee ? "New password" : "Password"}
            error={err("password")}
            hint={employee ? "Leave blank to keep the current password" : "At least 8 characters"}
          >
            <input type="password" autoComplete="new-password" required={!employee} {...bind("password")} />
          </Field>
          <Field label="Department" error={err("department")}>
            <select required {...bind("department")}>
              <option value="">Select…</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Employee code" error={err("employee_code")}><input required maxLength={20} placeholder="EMP010" {...bind("employee_code")} /></Field>
          <Field label="Job title" error={err("job_title")}><input required maxLength={100} {...bind("job_title")} /></Field>
          <Field label="Phone" error={err("phone")}><input maxLength={20} placeholder="+91 98765 43210" {...bind("phone")} /></Field>
          <Field label="Joined on" error={err("joined_on")}><input type="date" required max={todayISO()} {...bind("joined_on")} /></Field>
        </div>
        {employee && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            Account active (can log in)
          </label>
        )}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}