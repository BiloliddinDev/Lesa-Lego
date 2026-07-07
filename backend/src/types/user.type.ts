export interface CreateUserDTO {
  telegramId: number;
  name: string;
  username?: string;
  role: "WORKER";
}

export interface UpdateUserDTO {
  name?: string;
  isActive?: boolean;
}

export interface AuditFilters {
  action?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
}

export interface GetUsersFilters {
  isActive?: boolean;
  role?: "ADMIN" | "WORKER";
}
