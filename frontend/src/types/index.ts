export type Role = "ADMIN" | "EMPLOYEE";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface User {
  id: number; username: string; email: string;
  first_name: string; last_name: string; full_name: string; role: Role;
}
export interface LoginResponse { access: string; refresh: string; user: User }

export interface Paginated<T> {
  count: number; next: string | null; previous: string | null; results: T[];
}

export interface Department { id: number; name: string; description: string; employee_count: number }

export interface Employee {
  id: number; user_id: number; username: string; email: string;
  first_name: string; last_name: string; full_name: string; is_active: boolean;
  department: number; department_name: string; employee_code: string;
  job_title: string; phone: string; joined_on: string; created_at: string;
}
export interface EmployeeInput {
  username: string; email: string; first_name: string; last_name: string;
  password?: string; is_active?: boolean; department: number;
  employee_code: string; job_title: string; phone: string; joined_on: string;
}

export interface LeaveType { id: number; name: string; default_days: number }

export interface LeaveBalance {
  id: number; user: number; user_name: string; leave_type: number; leave_type_name: string;
  year: number; total_days: number; used_days: number; remaining_days: number;
}

export interface LeaveRequest {
  id: number; employee: number; employee_name: string; leave_type: number; leave_type_name: string;
  start_date: string; end_date: string; days: number; reason: string; status: LeaveStatus;
  reviewed_by: number | null; reviewed_by_name: string | null; review_comment: string;
  reviewed_at: string | null; created_at: string;
}
export interface LeaveRequestInput {
  leave_type: number; start_date: string; end_date: string; reason: string;
}

export interface TrendPoint { month: string; count: number }
export type StatusCounts = Record<LeaveStatus, number>;

export interface AdminDashboard {
  role: "ADMIN";
  totals: { employees: number; departments: number; pending_requests: number; on_leave_today: number };
  requests_by_status: StatusCounts;
  requests_by_type: { name: string; count: number }[];
  monthly_trend: TrendPoint[];
  recent_pending: LeaveRequest[];
}
export interface EmployeeDashboard {
  role: "EMPLOYEE";
  balances: LeaveBalance[];
  requests_by_status: StatusCounts;
  monthly_trend: TrendPoint[];
  upcoming_leaves: LeaveRequest[];
}
export type Dashboard = AdminDashboard | EmployeeDashboard;

export interface Notice { kind: "success" | "error"; text: string }