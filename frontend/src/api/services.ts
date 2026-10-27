import { api, clean } from "./client";
import type { ListParams } from "./client";
import type {
  Dashboard, Department, Employee, EmployeeInput, LeaveBalance, LeaveRequest,
  LeaveRequestInput, LeaveType, LoginResponse, Paginated, User,
} from "../types";

const getList = <T>(url: string, params?: ListParams) =>
  api.get<Paginated<T>>(url, { params: clean(params) }).then((r) => r.data);

export const authApi = {
  login: (username: string, password: string) =>
    api.post<LoginResponse>("/auth/login/", { username, password }).then((r) => r.data),
  logout: (refresh: string) => api.post("/auth/logout/", { refresh }),
  me: () => api.get<User>("/auth/me/").then((r) => r.data),
  changePassword: (old_password: string, new_password: string) =>
    api.post("/auth/change-password/", { old_password, new_password }),
};

export const departmentsApi = {
  list: (params?: ListParams) => getList<Department>("/departments/", params),
  create: (data: { name: string; description: string }) =>
    api.post<Department>("/departments/", data).then((r) => r.data),
  update: (id: number, data: { name: string; description: string }) =>
    api.patch<Department>(`/departments/${id}/`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/departments/${id}/`),
};

export const employeesApi = {
  list: (params?: ListParams) => getList<Employee>("/employees/", params),
  me: () => api.get<Employee>("/employees/me/").then((r) => r.data),
  create: (data: EmployeeInput) => api.post<Employee>("/employees/", data).then((r) => r.data),
  update: (id: number, data: Partial<EmployeeInput>) =>
    api.patch<Employee>(`/employees/${id}/`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/employees/${id}/`),
};

export const leaveTypesApi = {
  list: (params?: ListParams) => getList<LeaveType>("/leave-types/", params),
};

export const balancesApi = {
  list: (params?: ListParams) => getList<LeaveBalance>("/leave-balances/", params),
  update: (id: number, total_days: number) =>
    api.patch<LeaveBalance>(`/leave-balances/${id}/`, { total_days }).then((r) => r.data),
};

export const leavesApi = {
  list: (params?: ListParams) => getList<LeaveRequest>("/leave-requests/", params),
  create: (data: LeaveRequestInput) =>
    api.post<LeaveRequest>("/leave-requests/", data).then((r) => r.data),
  approve: (id: number, comment: string) =>
    api.post<LeaveRequest>(`/leave-requests/${id}/approve/`, { comment }).then((r) => r.data),
  reject: (id: number, comment: string) =>
    api.post<LeaveRequest>(`/leave-requests/${id}/reject/`, { comment }).then((r) => r.data),
  cancel: (id: number) =>
    api.post<LeaveRequest>(`/leave-requests/${id}/cancel/`).then((r) => r.data),
};

export const dashboardApi = {
  get: () => api.get<Dashboard>("/dashboard/").then((r) => r.data),
};