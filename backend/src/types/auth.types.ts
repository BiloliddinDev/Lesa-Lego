export type UserRole = "ADMIN" | "WORKER";

export interface AdminUserType {
  name: string;
  phoneNumber: string;
  username: string;
  role: UserRole;
  telegramId: number;
  isActive: boolean;
  avatarUrl: string;
}

export interface JwtPayload {
  userId: string;
  telegramId: number;
  role: "ADMIN" | "WORKER";
}
