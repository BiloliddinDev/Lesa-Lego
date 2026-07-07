# 06 — Auth

## Umumiy tushuncha

Tizimda foydalanuvchi **Telegram WebApp** orqali kiradi.
Parol yo'q — Telegram o'zi kim ekanini kafolatlaydi.

```
Foydalanuvchi Telegram da WebApp ochadi
  → Telegram initData beradi (signed, HMAC-SHA256)
  → Backend initData ni verify qiladi
  → DB dan user topadi (role bilan)
  → JWT qaytaradi (7 kun)
  → Frontend har so'rovga JWT qo'shadi
```

---

## Telegram initData nima?

WebApp ochilganda `window.Telegram.WebApp.initData` string bo'ladi:

```
query_id=AAHdF6IQAAAAA...
&user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22Alisher%22%7D
&auth_date=1719648000
&hash=a1b2c3d4e5f6...
```

Decode qilinganda:

```json
{
  "query_id": "AAHdF6IQAAAAA...",
  "user": {
    "id": 123456789,
    "first_name": "Alisher",
    "last_name": "Karimov",
    "username": "alisher_k",
    "language_code": "uz"
  },
  "auth_date": 1719648000,
  "hash": "a1b2c3d4e5f6..."
}
```

---

## initData Verification (backend)

Telegram rasmiy algoritmiga ko'ra:

```typescript
// src/services/AuthService.ts

import crypto from "crypto";

export class AuthService {
  /**
   * Telegram initData ni verify qiladi
   * @returns decoded user yoki xato tashlaydi
   */
  static verifyInitData(initData: string): TelegramUser {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");

    if (!hash) {
      throw new AppError("AUTH_INVALID_INIT_DATA", "Hash yo'q", 401);
    }

    // auth_date tekshirish (24 soatdan eski bo'lmasin)
    const authDate = Number(params.get("auth_date"));
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) {
      throw new AppError("AUTH_INVALID_INIT_DATA", "initData eskirgan", 401);
    }

    // Hash ni hisoblash uchun parametrlarni tayyorlash
    params.delete("hash");
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    // Secret key = HMAC-SHA256("WebAppData", BOT_TOKEN)
    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(process.env.BOT_TOKEN!)
      .digest();

    // Computed hash
    const computedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (computedHash !== hash) {
      throw new AppError("AUTH_INVALID_INIT_DATA", "initData noto'g'ri", 401);
    }

    // User ma'lumotlarini parse qilish
    const userStr = params.get("user");
    if (!userStr) {
      throw new AppError("AUTH_INVALID_INIT_DATA", "User ma'lumoti yo'q", 401);
    }

    return JSON.parse(decodeURIComponent(userStr)) as TelegramUser;
  }

  /**
   * Foydalanuvchini DB dan topadi yoki xato tashlaydi
   */
  static async findUser(telegramId: number): Promise<IUser> {
    const user = await User.findOne({ telegramId, isActive: true });
    if (!user) {
      throw new AppError(
        "AUTH_USER_NOT_FOUND",
        "Siz tizimga qo'shilmagansiz",
        403,
      );
    }
    return user;
  }

  /**
   * JWT token generatsiya
   */
  static signToken(user: IUser): string {
    return jwt.sign(
      {
        userId: user._id.toString(),
        telegramId: user.telegramId,
        role: user.role,
      },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" },
    );
  }
}
```

---

## Auth Controller

```typescript
// src/routes/auth.ts

router.post("/telegram", async (req, res, next) => {
  try {
    const { initData } = req.body;

    if (!initData) {
      throw new AppError("VALIDATION_ERROR", "initData kerak", 400);
    }

    // 1. initData verify
    const tgUser = AuthService.verifyInitData(initData);

    // 2. DB dan user topish
    const user = await AuthService.findUser(tgUser.id);

    // 3. fullName yangilash (Telegram da o'zgargan bo'lishi mumkin)
    if (
      user.fullName !== `${tgUser.first_name} ${tgUser.last_name || ""}`.trim()
    ) {
      await User.findByIdAndUpdate(user._id, {
        fullName: `${tgUser.first_name} ${tgUser.last_name || ""}`.trim(),
        username: tgUser.username,
      });
    }

    // 4. JWT berish
    const token = AuthService.signToken(user);

    res.json({
      data: {
        token,
        user: {
          _id: user._id,
          telegramId: user.telegramId,
          fullName: user.fullName,
          role: user.role,
          isActive: user.isActive,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});
```

---

## Auth Middleware

```typescript
// src/middleware/auth.ts

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new AppError("AUTH_INVALID_INIT_DATA", "Token yo'q", 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

    // DB dan user (isActive tekshirish uchun)
    const user = await User.findById(payload.userId).lean();
    if (!user || !user.isActive) {
      throw new AppError("AUTH_FORBIDDEN", "Kirish taqiqlangan", 403);
    }

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      next(new AppError("AUTH_TOKEN_EXPIRED", "Token muddati o'tgan", 401));
    } else {
      next(err);
    }
  }
}

// Admin tekshirish
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    throw new AppError("AUTH_FORBIDDEN", "Faqat admin uchun", 403);
  }
  next();
}

// Express type extension
declare global {
  namespace Express {
    interface Request {
      user: IUser;
    }
  }
}
```

---

## Frontend: Auth Flow

```typescript
// hooks/useAuth.ts

const TOKEN_KEY = "lesa_lego_token";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initAuth();
  }, []);

  async function initAuth() {
    try {
      // Telegram WebApp SDK
      const tg = window.Telegram?.WebApp;
      if (!tg) {
        console.error("Telegram WebApp environment yo'q");
        return;
      }

      tg.ready();
      const initData = tg.initData;

      if (!initData) {
        console.error("initData yo'q");
        return;
      }

      // Saqlangan token bor bo'lsa — avval uni sinab ko'r
      const savedToken = localStorage.getItem(TOKEN_KEY);
      if (savedToken) {
        try {
          const me = await api.get("/auth/me");
          setUser(me.data.data);
          setLoading(false);
          return;
        } catch {
          localStorage.removeItem(TOKEN_KEY);
        }
      }

      // Yangi token olish
      const res = await api.post("/auth/telegram", { initData });
      const { token, user } = res.data.data;

      localStorage.setItem(TOKEN_KEY, token);
      api.defaults.headers.Authorization = `Bearer ${token}`;
      setUser(user);
    } catch (err) {
      console.error("Auth xatosi:", err);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    delete api.defaults.headers.Authorization;
    setUser(null);
  }

  return { user, loading, logout };
}
```

---

## Frontend: Axios Interceptor

```typescript
// lib/api.ts

import axios from "axios";

const TOKEN_KEY = "lesa_lego_token";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 10000,
});

// Request: token qo'shish
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response: xatoliklarni ushlash
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const code = error.response?.data?.error?.code;
    const message = error.response?.data?.error?.message;

    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      // WebApp ni qayta yuklash
      window.Telegram?.WebApp?.close();
    }

    // Toast ko'rsatish (sonora yoki react-hot-toast)
    if (message) {
      toast.error(message);
    }

    return Promise.reject(error);
  },
);
```

---

## Birinchi Admin qo'shish

Tizim birinchi marta ishga tushganda admin qo'lda DB ga qo'shiladi:

```typescript
// scripts/createAdmin.ts
// npx tsx scripts/createAdmin.ts

import mongoose from "mongoose";
import { User } from "../src/models/User";

await mongoose.connect(process.env.MONGODB_URI!);

await User.create({
  telegramId: 123456789, // Sizning Telegram ID ingiz
  fullName: "Alisher Karimov",
  username: "alisher_k",
  role: "ADMIN",
  isActive: true,
});

console.log("Admin yaratildi!");
process.exit(0);
```

Telegram ID topish: @userinfobot ga /start yuboring.

---

## Xavfsizlik

1. **initData 24 soat** — eskirgan initData ishlamaydi
2. **JWT 7 kun** — WebApp sessiyasi uzoq bo'lishi uchun
3. **isActive tekshirish** — bloklangan worker har so'rovda to'xtaydi (JWT muddati kutilmaydi)
4. **Role middleware** — har bir admin endpoint da `requireAdmin` middleware
5. **BOT_TOKEN maxfiy** — faqat backend da, hech qachon frontend ga
