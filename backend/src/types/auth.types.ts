export type UserRole = "ADMIN" | "WORKER";

export interface IUserType {
  name: string;
  phoneNumber?: string;
  username?: string;
  role: UserRole;
  telegramId?: number;
  isActive: boolean;
  avatarUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface JwtPayload {
  userId: string;
  telegramId: number;
  role: "ADMIN" | "WORKER";
}
