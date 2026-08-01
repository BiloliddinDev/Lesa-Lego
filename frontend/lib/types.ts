export interface User {
  _id: string;
  telegramId: number;
  name: string;
  username?: string;
  role: "ADMIN" | "WORKER";
  isActive: boolean;
  createdAt?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Category {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
  order: number;
  createdAt?: string;
}

export interface Equipment {
  _id: string;
  category: { _id: string; name: string };
  name: string;
  description?: string;
  totalQuantity: number;
  rentedQuantity: number;
  availableQuantity: number;
  dailyRate: number;
  isActive: boolean;
}

export interface Client {
  _id: string;
  fullName: string;
  phone: string;
  telegramId?: number;
  address?: string;
  note?: string;
  totalDebt: number;
  isActive: boolean;
  createdBy?: { _id: string; name: string };
  createdAt?: string;
}

export interface RentalItem {
  equipment: string;
  equipmentName: string;
  equipmentCategory: string;
  quantity: number;
  dailyRate: number;
  returnedQuantity: number;
  returns: ReturnEvent[];
}

export interface ReturnEvent {
  date: string;
  quantity: number;
  note?: string;
  doneBy: string;
}

export interface Rental {
  _id: string;
  rentalNumber: string;
  client: { _id: string; fullName: string; phone: string };
  createdBy: { _id: string; name: string };
  items: RentalItem[];
  startDate: string;
  expectedEndDate?: string;
  endDate?: string;
  status: "active" | "overdue" | "completed";
  depositAmount: number;
  paidAmount: number;
  note?: string;
  deliveryLocation?: {
    lat: number;
    lng: number;
    label?: string;
  };
  createdAt?: string;
}

export interface DailyScheduleEntry {
  date: string;
  dayNumber: number;
  dailyAmount: number;
  cumulativeAmount: number;
}

export interface RentalCheck {
  rentalNumber: string;
  client: { fullName: string; phone: string };
  startDate: string;
  checkDate: string;
  status: string;
  items: RentalCheckItem[];
  dailySchedule: DailyScheduleEntry[];
  totalAmount: number;
  depositAmount: number;
  paidAmount: number;
  debt: number;
  overpaid: number;
}

export interface RentalCheckItem {
  equipmentName: string;
  quantity: number;
  returnedQuantity: number;
  activeQuantity: number;
  dailyRate: number;
  segments: Segment[];
  itemTotal: number;
}

export interface Segment {
  from: string;
  to: string;
  quantity: number;
  days: number;
  amount: number;
}

export interface Payment {
  _id: string;
  rental: { _id: string; rentalNumber: string };
  client: { _id: string; fullName: string };
  amount: number;
  method: "cash" | "card" | "transfer";
  note?: string;
  createdBy: { _id: string; name: string };
  createdAt: string;
}

export interface Debt {
  _id: string;
  client: { _id: string; fullName: string; phone: string };
  rental: { _id: string; rentalNumber: string };
  amount: number;
  dueDate?: string;
  paidDate?: string;
  status: "pending" | "paid" | "overdue";
  note?: string;
}

export interface CompanySettings {
  _id: string;
  companyName: string;
  ownerName: string;
  address: string;
  phone: string;
  inn?: string;
  bankAccount?: string;
  bankName?: string;
  logoBase64?: string;
  stampBase64?: string;
  signatureBase64?: string;
  contractTemplate?: string;
  rentalTerms?: string;
}

export interface DashboardSummary {
  today: string;
  activeRentals: number;
  overdueRentals: number;
  totalDebtors: number;
  totalDebt: number;
  equipmentStats: {
    totalOut: number;
    totalAvailable: number;
  };
  todayStats: {
    newRentals: number;
    closedRentals: number;
    paymentsReceived: number;
    newClients: number;
  };
}

export interface MonthlyReport {
  period: string;
  revenue: number;
  newRentals: number;
  closedRentals: number;
  newClients: number;
  paymentsReceived: number;
  topClients: { fullName: string; totalPaid: number }[];
  topEquipment: { name: string; rentalCount: number }[];
  dailyRevenue: { date: string; amount: number }[];
}

export interface OverdueRental {
  rentalNumber: string;
  client: { fullName: string; phone: string; telegramId?: number };
  expectedEndDate: string;
  overdueDays: number;
  items: { equipmentName: string; activeQuantity: number }[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface EquipmentHistoryEntry {
  _id: string;
  rentalNumber: string;
  client: { _id: string; fullName: string; phone: string };
  createdBy: { _id: string; name: string };
  startDate: string;
  endDate?: string;
  status: "active" | "completed";
  quantity: number;
  returnedQuantity: number;
  activeQuantity: number;
  dailyRate: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string[]>;
  };
}
