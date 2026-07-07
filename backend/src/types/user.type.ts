export interface CreateUserDTO {
  telegramId: number;
  fullName: string;
  username?: string;
  role: "WORKER";
}

export interface UpdateUserDTO {
  fullName?: string;
  isActive?: boolean;
}

export interface AuditFilters {
  action?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
}
