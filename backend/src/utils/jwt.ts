import jwt from "jsonwebtoken";

export interface JwtPayload {
  userId: string;
  telegramId: number;
  role: "ADMIN" | "WORKER";
}

export function signToken(payload: JwtPayload): string {
  const secret = process.env.JWT_SECRET!;

  return jwt.sign(payload, secret, {
    expiresIn: "7d",
  });
}

export function verifyToken(token: string): JwtPayload {
  const secret = process.env.JWT_SECRET!;
  return jwt.verify(token, secret) as JwtPayload;
}
