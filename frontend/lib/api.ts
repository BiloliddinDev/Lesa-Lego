import type { AuthResponse, AuditLogEntry, User, Category, Equipment, Client, Rental, RentalCheck, Payment, Debt, CompanySettings, DashboardSummary, OverdueRental, MonthlyReport, EquipmentHistoryEntry } from "./types";
import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      // Login sahifasi "/" da joylashgan. Ilgari bu yerda "/login" turardi —
      // bunday route umuman yo'q, ya'ni token muddati o'tganda foydalanuvchi
      // login o'rniga 404 sahifasiga tushardi.
      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  },
);

// Users endpoints (Admin only)
export const usersApi = {
  getAll: (params?: { isActive?: boolean; role?: string }) =>
    api.get<{ data: User[] }>("/users", { params }).then((r) => r.data.data),
  create: (data: { telegramId: number; name: string; username?: string }) =>
    api.post<{ data: User }>("/users", { ...data, role: "WORKER" }).then((r) => r.data.data),
  update: (id: string, data: { name?: string; isActive?: boolean }) =>
    api.patch<{ data: User }>(`/users/${id}`, data).then((r) => r.data.data),
  getAudit: (id: string, params?: { action?: string; page?: number; limit?: number }) =>
    api
      .get<{ data: AuditLogEntry[]; total: number; page: number; totalPages: number }>(
        `/users/${id}/audit`,
        { params },
      )
      .then((r) => r.data),
};

// Auth endpoints
export const authApi = {
  telegramLogin: (initData: string) =>
    api.post<{ data: AuthResponse }>("/auth/telegram", { initData }).then((r) => r.data.data),
  devLogin: (data: { telegramId?: number; userId?: string }) =>
    api.post<{ data: AuthResponse }>("/auth/dev-login", data).then((r) => r.data.data),
  devSetup: (data?: { name?: string; telegramId?: number }) =>
    api.post<{ data: AuthResponse }>("/auth/dev-setup", data || {}).then((r) => r.data.data),
  devUsers: () =>
    api.get<{ data: User[] }>("/auth/dev-users").then((r) => r.data.data),
  me: () => api.get<{ data: User }>("/auth/me").then((r) => r.data.data),
};

// Categories endpoints
export const categoriesApi = {
  getAll: () =>
    api.get<{ data: Category[] }>("/categories").then((r) => r.data.data),
  getById: (id: string) =>
    api.get<{ data: Category }>(`/categories/${id}`).then((r) => r.data.data),
  create: (data: { name: string; description?: string; order?: number }) =>
    api.post<{ data: Category }>("/categories", data).then((r) => r.data.data),
  update: (id: string, data: Partial<Category>) =>
    api.patch<{ data: Category }>(`/categories/${id}`, data).then((r) => r.data.data),
  delete: (id: string) =>
    api.delete(`/categories/${id}`).then((r) => r.data),
};

// Equipment endpoints
export const equipmentApi = {
  getAll: (params?: { categoryId?: string; search?: string; available?: boolean }) =>
    api.get<{ data: Equipment[] }>("/equipment", { params }).then((r) => r.data.data),
  getById: (id: string) =>
    api.get<{ data: Equipment }>(`/equipment/${id}`).then((r) => r.data.data),
  create: (data: { categoryId: string; name: string; totalQuantity: number; dailyRate: number; description?: string }) =>
    api.post<{ data: Equipment }>("/equipment", data).then((r) => r.data.data),
  update: (id: string, data: Partial<Equipment>) =>
    api.patch<{ data: Equipment }>(`/equipment/${id}`, data).then((r) => r.data.data),
  adjustQuantity: (id: string, adjustment: number, reason: string) =>
    api.patch<{ data: Equipment }>(`/equipment/${id}/quantity`, { adjustment, reason }).then((r) => r.data.data),
  delete: (id: string) =>
    api.delete(`/equipment/${id}`).then((r) => r.data),
  getHistory: (id: string) =>
    api.get<{ data: EquipmentHistoryEntry[] }>(`/equipment/${id}/history`).then((r) => r.data.data),
};

// Clients endpoints
export const clientsApi = {
  getAll: (params?: { search?: string; hasDebt?: boolean; page?: number; limit?: number }) =>
    api.get<{ data: Client[]; total: number; page: number; totalPages: number }>("/clients", { params }).then((r) => r.data),
  getById: (id: string) =>
    api.get<{ data: Client }>(`/clients/${id}`).then((r) => r.data.data),
  create: (data: { fullName: string; phone: string; address?: string; telegramId?: number; note?: string }) =>
    api.post<{ data: Client }>("/clients", data).then((r) => r.data.data),
  update: (id: string, data: Partial<Client>) =>
    api.patch<{ data: Client }>(`/clients/${id}`, data).then((r) => r.data.data),
  delete: (id: string) =>
    api.delete(`/clients/${id}`).then((r) => r.data),
};

// Rentals endpoints
export const rentalsApi = {
  getAll: (params?: { status?: string; clientId?: string; createdBy?: string; page?: number; limit?: number }) =>
    api.get<{ rentals: Rental[]; total: number; page: number; totalPages: number }>("/rentals", { params }).then((r) => r.data),
  getById: (id: string) =>
    api.get<{ data: Rental }>(`/rentals/${id}`).then((r) => r.data.data),
  create: (data: { clientId: string; items: { equipmentId: string; quantity: number }[]; startDate: string; expectedEndDate?: string; depositAmount?: number; note?: string; deliveryLocation?: { lat: number; lng: number; label?: string } }) =>
    api.post<{ data: Rental }>("/rentals", data).then((r) => r.data.data),
  getCheck: (id: string) =>
    api.get<{ data: RentalCheck }>(`/rentals/${id}/check`).then((r) => r.data.data),
  returnItems: (id: string, data: { returns: { equipmentId: string; quantity: number; note?: string }[]; returnDate?: string }) =>
    api.post(`/rentals/${id}/return`, data).then((r) => r.data.data),
  close: (id: string, data?: { endDate?: string; note?: string; debtDueDate?: string }) =>
    api.post(`/rentals/${id}/close`, data || {}).then((r) => r.data.data),
  update: (id: string, data: { expectedEndDate?: string; note?: string; deliveryLocation?: { lat: number; lng: number; label?: string } }) =>
    api.patch<{ data: Rental }>(`/rentals/${id}`, data).then((r) => r.data.data),
  sendPdf: (id: string, data: { type: string; toClient?: boolean }) =>
    api
      .post<{ data: { sent: boolean; type: string; toClient: boolean } }>(
        `/rentals/${id}/send-pdf`,
        data,
      )
      .then((r) => r.data.data),
  getPdf: (id: string, type: string) =>
    api.get(`/rentals/${id}/pdf`, { params: { type }, responseType: "blob" }).then((r) => r.data),
};

// Payments endpoints
export const paymentsApi = {
  getAll: (params?: { rentalId?: string; clientId?: string; method?: string; page?: number; limit?: number }) =>
    api.get<{ data: Payment[]; total: number; page: number; totalPages: number }>("/payments", { params }).then((r) => r.data),
  create: (data: { rentalId: string; amount: number; method: string; note?: string }) =>
    api.post<{ data: Payment }>("/payments", data).then((r) => r.data.data),
  delete: (id: string) =>
    api.delete(`/payments/${id}`).then((r) => r.data),
};

// Debts endpoints
export const debtsApi = {
  getAll: (params?: { status?: string; clientId?: string; page?: number; limit?: number }) =>
    api.get<{ data: Debt[]; total: number; page: number; totalPages: number }>("/debts", { params }).then((r) => r.data),
  create: (data: { clientId: string; rentalId: string; amount: number; dueDate?: string; note?: string }) =>
    api.post<{ data: Debt }>("/debts", data).then((r) => r.data.data),
  pay: (id: string, data: { amount: number; method: string; note?: string }) =>
    api.post<{ data: { debt: Debt; payment: Payment } }>(`/debts/${id}/pay`, data).then((r) => r.data.data),
};

// Settings endpoints
export const settingsApi = {
  get: () =>
    api.get<{ data: CompanySettings }>("/settings").then((r) => r.data.data),
  update: (data: Partial<CompanySettings>) =>
    api.patch<{ data: CompanySettings }>("/settings", data).then((r) => r.data.data),
};

// Reports endpoints
export const reportsApi = {
  getSummary: () =>
    api.get<{ data: DashboardSummary }>("/reports/summary").then((r) => r.data.data),
  getMonthly: (year: number, month: number) =>
    api.get<{ data: MonthlyReport }>("/reports/monthly", { params: { year, month } }).then((r) => r.data.data),
  getOverdue: () =>
    api.get<{ data: OverdueRental[] }>("/reports/overdue").then((r) => r.data.data),
};

