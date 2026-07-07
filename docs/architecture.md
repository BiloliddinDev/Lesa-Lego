# 03 — Arxitektura

## Umumiy arxitektura

```
┌─────────────────────────────────────────────────────-┐
│                    TELEGRAM                          │
│                                                      │
│  Foydalanuvchi → /start → Bot → "Ilovani ochish"     │
│                              ↓                       │
│                    [WebApp Button]                   │
│                              ↓                       │
│              ┌───────────────────────────┐           │
│              │   Next.js WebApp           │          │
│              │   (Vercel)                │           │
│              │   Telegram UI stilida     │           │
│              └──────────┬────────────────┘           │
│                         │ REST API                   │
└─────────────────────────┼───────────────────────────-┘
                          │
          ┌───────────────▼─────────────────┐
          │        Express.js Backend        │
          │           (Fly.io)               │
          │                                  │
          │  ┌──────────┐  ┌──────────────┐ │
          │  │ Grammy   │  │  PDFKit      │ │
          │  │ Bot      │  │  (PDF gen)   │ │
          │  └────┬─────┘  └──────────────┘ │
          │       │ notification             │
          │  ┌────▼─────┐  ┌──────────────┐ │
          │  │ Telegram  │  │  node-cron   │ │
          │  │ API       │  │  (overdue)   │ │
          │  └──────────┘  └──────────────┘ │
          └───────────────┬─────────────────┘
                          │
          ┌───────────────▼─────────────────┐
          │         MongoDB Atlas            │
          │                                  │
          │  users · categories · equipment  │
          │  clients · rentals · payments    │
          │  auditlogs                       │
          └──────────────────────────────────┘
```

---

## Request-Response Sikli

### 1. Foydalanuvchi WebApp ochadi

```
Telegram → WebApp ochiladi
  → initData (Telegram dan keladi)
  → Frontend: POST /api/auth/telegram { initData }
  → Backend: initData ni verify qiladi (HMAC-SHA256)
  → Backend: DB dan user topadi (role bilan)
  → Backend: JWT qaytaradi
  → Frontend: JWT localStorage da saqlaydi
  → Barcha keyingi so'rovlarga Authorization header qo'shadi
```

### 2. Oddiy so'rov sikli

```
Frontend
  → Axios: GET /api/rentals (Authorization: Bearer JWT)
  → auth middleware: JWT decode → req.user = { id, role }
  → route handler: RentalController.getAll(req, res)
  → RentalService.getAll({ userId, role, filters })
  → MongoDB query
  → Response: { data: [...], total: N }
  → React Query: cache ga saqlaydi
  → UI render
```

### 3. PDF generatsiya

```
Admin/Worker: "Nakladnoy olish" tugmasi
  → GET /api/rentals/:id/pdf?type=nakladnoy
  → auth middleware ✓
  → PdfService.generateNakladnoy(rental)
    → CompanySettings dan kompaniya ma'lumotlari
    → rental.client dan mijoz ma'lumotlari
    → rental.items dan jihozlar ro'yxati
    → PDFKit: matn, jadval, imzo joylari
    → Buffer qaytaradi
  → res.setHeader('Content-Type', 'application/pdf')
  → res.send(buffer)
  → Browser: PDF yuklab oladi yoki ko'rsatadi
```

### 4. Bot notification

```
Arenda yaratildi → RentalService.create()
  → NotifyService.rentalCreated(rental)
    → Grammy: bot.api.sendMessage(ADMIN_CHAT_ID, text)
    → Telegram API ga so'rov ketadi
    → Admin telefoniga xabar keladi
```

### 5. Cron job (overdue check)

```
Har kuni 09:00 da (node-cron):
  → OverdueCheckJob.run()
  → Barcha active rental lari qidiradi
    WHERE expectedEndDate < today
  → Status ni "overdue" ga o'zgartiradi
  → Har biri uchun NotifyService.overdueAlert(rental)
    → Admin ga: "⚠ ARN-2025-0003 muddati o'tdi (3 kun)"
    → Agar client.telegramId bo'lsa → clientga ham xabar
```

---

## Middleware zanjiri

```
Request
  ↓
cors()                    # CORS headers
  ↓
express.json()            # Body parser
  ↓
morgan()                  # Request logging (dev)
  ↓
/api/auth/* → authRouter  # Auth endpointlar (JWT yo'q)
  ↓
authMiddleware            # JWT verify, req.user set
  ↓
roleMiddleware(role)      # Admin-only endpointlar
  ↓
validateMiddleware(schema) # Zod validation
  ↓
routeHandler              # Controller
  ↓
errorHandler              # Global xato tutuvchi
```

---

## Auth arxitekturasi

### Telegram initData validation

```typescript
// Telegram docs bo'yicha HMAC-SHA256 tekshirish
function verifyInitData(initData: string, botToken: string): boolean {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  params.delete("hash");

  // Parametrlarni alfavit tartibida saralash
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  // HMAC key = HMAC-SHA256("WebAppData", botToken)
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  // Hash = HMAC-SHA256(dataCheckString, secretKey)
  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  return computedHash === hash;
}
```

### JWT Payload

```typescript
interface JwtPayload {
  userId: string; // MongoDB _id
  telegramId: number;
  role: "admin" | "worker";
  iat: number;
  exp: number; // 7 kun
}
```

### Auth Middleware

```typescript
async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Token yo'q" });

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const user = await User.findById(payload.userId);
    if (!user || !user.isActive)
      return res.status(403).json({ error: "Kirish taqiqlangan" });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Token yaroqsiz" });
  }
}

// Role tekshirish
function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Faqat admin uchun" });
  }
  next();
}
```

---

## Worker huquqlari jadvali

| Amal                             | Admin | Worker |
| -------------------------------- | ----- | ------ |
| Dashboard ko'rish                | ✅    | ✅     |
| Arendalar ro'yxati (o'ziniki)    | ✅    | ✅     |
| Arendalar ro'yxati (hammasi)     | ✅    | ❌     |
| Yangi arenda ochish              | ✅    | ✅     |
| Arenda yopish                    | ✅    | ✅     |
| Jihoz qaytarish                  | ✅    | ✅     |
| Joriy check ko'rish              | ✅    | ✅     |
| Yakuniy check/nakladnoy PDF      | ✅    | ✅     |
| Mijoz qo'shish                   | ✅    | ✅     |
| Mijoz tahrirlash                 | ✅    | ❌     |
| To'lov kiritish                  | ✅    | ✅     |
| To'lovni bekor qilish            | ✅    | ❌     |
| Kategoriya qo'shish/o'zgartirish | ✅    | ❌     |
| Jihoz qo'shish/o'zgartirish      | ✅    | ❌     |
| Jihoz narxini o'zgartirish       | ✅    | ❌     |
| Hisobotlar                       | ✅    | ❌     |
| Worker qo'shish/bloklash         | ✅    | ❌     |
| Kompaniya sozlamalari            | ✅    | ❌     |
| Audit log ko'rish                | ✅    | ❌     |

---

## Audit Log arxitekturasi

Har bir muhim amal qayd etiladi:

```typescript
interface IAuditLog {
  _id: ObjectId;
  userId: ObjectId; // Kim qildi
  userRole: string; // Admin yoki Worker
  action: AuditAction; // Nima qildi
  resourceType: string; // 'rental' | 'payment' | 'client' | ...
  resourceId: ObjectId; // Qaysi resurs
  before?: object; // O'zgarishdan oldin
  after?: object; // O'zgarishdan keyin
  ip?: string; // IP manzil (ixtiyoriy)
  createdAt: Date;
}

type AuditAction =
  | "rental.create"
  | "rental.close"
  | "rental.return_items"
  | "payment.create"
  | "payment.delete"
  | "client.create"
  | "client.update"
  | "equipment.price_change"
  | "user.create"
  | "user.block";
```

### Audit Middleware

```typescript
// Service ichida chaqiriladi
async function audit(params: AuditParams) {
  await AuditLog.create({
    userId: params.userId,
    userRole: params.userRole,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    before: params.before,
    after: params.after,
  });
}

// Misol: narx o'zgartirish
const before = await Equipment.findById(id);
await Equipment.findByIdAndUpdate(id, { dailyRate: newRate });
await audit({
  userId: req.user._id,
  userRole: req.user.role,
  action: "equipment.price_change",
  resourceType: "equipment",
  resourceId: id,
  before: { dailyRate: before.dailyRate },
  after: { dailyRate: newRate },
});
```

---

## Error Handling arxitekturasi

### Backend: markaziy errorHandler

```typescript
// Barcha xatolar shu yerdan o'tadi
function errorHandler(err, req, res, next) {
  // Zod validation xatosi
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Ma'lumotlar noto'g'ri",
        fields: err.flatten().fieldErrors,
      },
    });
  }

  // MongoDB duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({
      error: {
        code: "DUPLICATE_ERROR",
        message: `Bu ${field} allaqachon mavjud`,
      },
    });
  }

  // Maxsus AppError lar
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
  }

  // Kutilmagan xatolar
  console.error(err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Server xatosi" },
  });
}
```

### Frontend: Axios interceptor

```typescript
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const code = error.response?.data?.error?.code;
    const message = error.response?.data?.error?.message;

    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      // Telegram WebApp ni yopish yoki bosh sahifaga qaytish
    }

    // Toast xabar ko'rsatish
    toast.error(message || "Xatolik yuz berdi");

    return Promise.reject(error);
  },
);
```

---

## Frontend Navigation

### Bottom Navigation (mobil)

```
[Dashboard] [Arendalar] [Mijozlar] [Jihozlar] [Sozlamalar]
```

### Sahifalar hierarxiyasi

```
/                           Dashboard
├── /rentals                Arendalar ro'yxati
│   ├── /rentals/new        Yangi arenda formi
│   └── /rentals/[id]       Arenda detail
│       ├── /return         Jihoz qaytarish
│       └── /check          Check ko'rish
├── /clients                Mijozlar ro'yxati
│   ├── /clients/new        Yangi mijoz
│   └── /clients/[id]       Mijoz + arendalar tarixi
├── /equipment              Jihozlar (category bo'yicha)
├── /debts                  Qarzdorlar (admin only)
├── /reports                Hisobotlar (admin only)
└── /settings               Sozlamalar (admin only)
    ├── Kompaniya ma'lumotlari
    ├── Xodimlar
    └── PDF shabloni
```

---

## Kompaniya sozlamalari (Settings)

Bu ma'lumotlar PDF da ishlatiladi:

```typescript
interface ICompanySettings {
  // Bitta hujjat (singleton)
  companyName: string; // "Lesa Lego MChJ"
  ownerName: string; // "Karimov Alisher"
  address: string; // "Toshkent sh, Chilonzor t..."
  phone: string; // "+998 90 123 45 67"
  inn?: string; // "123456789"
  bankAccount?: string; // Hisob raqam
  bankName?: string; // Bank nomi
  logo?: string; // Base64 yoki URL
  stampImage?: string; // Pechat rasmi (Base64)
  signatureImage?: string; // Imzo rasmi (Base64)
  contractTemplate?: string; // Shartnoma matni shablon
  updatedAt: Date;
}
```

---

## Caching strategiyasi (React Query)

```typescript
// queryKeys.ts
export const queryKeys = {
  rentals: {
    all: ["rentals"] as const,
    list: (filters) => ["rentals", "list", filters] as const,
    detail: (id) => ["rentals", id] as const,
    check: (id) => ["rentals", id, "check"] as const,
  },
  clients: {
    all: ["clients"] as const,
    list: (filters) => ["clients", "list", filters] as const,
    detail: (id) => ["clients", id] as const,
  },
  equipment: {
    all: ["equipment"] as const,
    byCategory: (catId) => ["equipment", "category", catId] as const,
  },
  reports: {
    summary: ["reports", "summary"] as const,
    monthly: (year, month) => ["reports", "monthly", year, month] as const,
  },
};

// Cache vaqtlari
const STALE_TIME = {
  rentals: 30_000, // 30 sekund (tez-tez o'zgaradi)
  clients: 60_000, // 1 daqiqa
  equipment: 5 * 60_000, // 5 daqiqa (kam o'zgaradi)
  reports: 10 * 60_000, // 10 daqiqa
};
```
