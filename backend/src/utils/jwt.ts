import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface JwtPayload {
  userId: string;
  telegramId: number;
  role: "ADMIN" | "WORKER";
}

export function signToken(payload: JwtPayload): string {
  // Ilgari muddat "7d" qilib QATTIQ yozilgan edi — `JWT_EXPIRES_IN`
  // sozlamasi o'zgartirilsa ham hech narsa o'zgarmasdi.
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
