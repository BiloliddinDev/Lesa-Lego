import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { User } from "../models/User";
import { AppError } from "../utils/AppError";

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: { code: "AUTH_TOKEN_MISSING", message: "Token yo'q" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const payload = verifyToken(token);

    const user = await User.findById(payload.userId);

    if (!user || !user.isActive) {
      return res.status(403).json({
        error: { code: "AUTH_FORBIDDEN", message: "Kirish taqiqlangan" },
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      error: {
        code: "AUTH_TOKEN_EXPIRED",
        message: "Token yaroqsiz yoki muddati o'tgan",
      },
    });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "ADMIN") {
    return next(
      new AppError("Faqat admin uchun ruxsat bor", 403, "AUTH_FORBIDDEN"),
    );
  }
  next();
}
