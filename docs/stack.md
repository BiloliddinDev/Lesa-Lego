# 02 — Stack va Texnologiyalar

## Backend

### Node.js + TypeScript
- Tanlash sababi: JavaScript full-stack (frontend bilan bir til)
- TypeScript: xatolarni erta ushlab olish, IDE support yaxshi
- Version: Node.js 20 LTS

### Express.js
- Tanlash sababi: yengil, tez, yaxshi bilasiz (Hisobchi loyihada ishlattingiz)
- Middleware arxitekturasi: auth → validate → handler
- Alternativ ko'rilmadi (NestJS og'ir, Fastify ortiqcha)

### MongoDB + Mongoose
- Tanlash sababi: flexible schema (arenda items embedded), JSON-like, Atlas bepul tier
- Mongoose: TypeScript bilan yaxshi ishlaydi, validatsiya built-in
- Atlas M0: 512MB bepul — bu loyiha uchun yetarli

### Grammy.js (Telegram Bot)
- Tanlash sababi: Telegraf dan yaxshiroq TypeScript support, aktiv community
- Faqat notification + /start → WebApp link uchun ishlatiladi
- Webhook mode (polling emas) — Fly.io da ishlaydi

### Zod
- DTO validation uchun — frontend va backend da bir xil sxema
- Express middleware bilan integratsiya: `zod-express-middleware`
- Xato xabarlari aniq va tartibli

### PDFKit
- Nakladnoy, Shartnoma, Check generatsiya uchun
- Tanlash sababi: pure Node.js, server-side, boshqa dependency yo'q
- Alternativlar: Puppeteer (og'ir), jsPDF (browser-only)
- Font: O'zbek belgilari uchun alohida TTF font yuklash kerak

### Day.js
- Sana hisoblash uchun (moment.js o'rniga)
- Yengil (2KB), immutable, plugin tizimi
- Kerakli pluginlar: `duration`, `customParseFormat`, `isBetween`

### JWT (jsonwebtoken)
- Telegram WebApp `initData` dan token generatsiya
- Access token: 7 kun (WebApp sessiyasi uzoq bo'ladi)
- Refresh token: yo'q (Telegram har ochilishda yangi initData beradi)

### bcrypt
- Faqat bitta joy: future uchun password hash (hozir kerak emas)
- Hozircha faqat dependency sifatida qoladi

### dotenv + envalid
- `.env` fayllarni type-safe o'qish
- `envalid`: env var yo'q bo'lsa startup da xato beradi (deployment xatolarini oldini oladi)

---

## Frontend

### Next.js 14 (App Router)
- Tanlash sababi: React-based, Vercel bilan mukammal integratsiya
- App Router: server components, layouts, loading states built-in
- Telegram WebApp sifatida ishlatiladi (iframe ichida)

### Telegram WebApp SDK
```html
<script src="https://telegram.org/js/telegram-web-app.js"></script>
```
- `window.Telegram.WebApp.initData` — auth uchun
- `window.Telegram.WebApp.themeParams` — Telegram ranglariga moslashish
- `window.Telegram.WebApp.BackButton` — orqaga tugmasi
- `window.Telegram.WebApp.MainButton` — asosiy tugma (arenda ochish, saqlash)

### ShadcnUI
- Tanlash sababi: copy-paste komponentlar, Tailwind bilan, to'liq customizable
- Kerakli komponentlar:
    - `Button`, `Input`, `Select`, `DatePicker`
    - `Table`, `Card`, `Badge`, `Dialog`
    - `Form` (React Hook Form bilan)
    - `Tabs`, `Sheet` (drawer), `Skeleton`

### Lucide React
- Icon kutubxonasi (ShadcnUI bilan birga keladi)
- Yengil, tree-shakeable

### TanStack Query (React Query v5)
- Server state boshqarish
- `useQuery`: ma'lumot olish + cache
- `useMutation`: yangilash/yaratish + optimistic update
- `queryClient.invalidateQueries`: o'zgarishdan keyin refresh
- Tanlash sababi: loading/error/refetch — avtomatik

### React Hook Form + Zod
- Form boshqarish (arenda ochish, mijoz qo'shish)
- `zodResolver`: backend bilan bir xil validation sxema
- Uncontrolled inputs: performance yaxshi

### Axios
- API client
- Interceptor: har so'rovga `Authorization: Bearer token` qo'shish
- Error interceptor: 401 → logout

### date-fns (yoki dayjs)
- Frontend da sana formatlash uchun
- `format(date, 'dd.MM.yyyy')` → "29.06.2025"

---

## DevOps

### Fly.io (Backend)
- Tanlash sababi: bepul tier bor, Docker-based, CLI qulay
- `fly launch` → `fly deploy`
- Internal port: 5000
- Health check: `GET /health`

### Vercel (Frontend)
- Next.js uchun native platform
- GitHub push → avtomatik deploy
- Environment variables: Vercel dashboard dan

### MongoDB Atlas
- M0 cluster (bepul, 512MB)
- Connection string `.env` da

### GitHub
- Bitta repo, ikki folder: `/backend` va `/frontend`
- Branch strategiyasi:
    - `main` — production
    - `dev` — development
    - `feature/*` — yangi feature

---

## Papka strukturasi (to'liq)

```
lesa-lego/
│
├── backend/
│   ├── src/
│   │   ├── bot/
│   │   │   ├── index.ts              # Grammy setup
│   │   │   └── handlers/
│   │   │       ├── start.ts          # /start → WebApp button
│   │   │       └── notifications.ts  # xabar yuborish funksiyalar
│   │   │
│   │   ├── config/
│   │   │   ├── db.ts                 # MongoDB ulanish
│   │   │   ├── env.ts                # envalid env validation
│   │   │   └── constants.ts          # STATUS, ROLES, va boshqalar
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.ts               # JWT verify + role check
│   │   │   ├── validate.ts           # Zod middleware
│   │   │   └── errorHandler.ts       # Global error handler
│   │   │
│   │   ├── models/
│   │   │   ├── User.ts
│   │   │   ├── Category.ts
│   │   │   ├── Equipment.ts
│   │   │   ├── Client.ts
│   │   │   ├── Rental.ts
│   │   │   ├── Payment.ts
│   │   │   └── AuditLog.ts
│   │   │
│   │   ├── routes/
│   │   │   ├── index.ts              # barcha routelarni birlashtiradi
│   │   │   ├── auth.ts
│   │   │   ├── users.ts
│   │   │   ├── categories.ts
│   │   │   ├── equipment.ts
│   │   │   ├── clients.ts
│   │   │   ├── rentals.ts
│   │   │   ├── payments.ts
│   │   │   ├── debts.ts
│   │   │   └── reports.ts
│   │   │
│   │   ├── services/
│   │   │   ├── AuthService.ts        # initData validate, JWT sign
│   │   │   ├── RentalService.ts      # hisob-kitob logikasi
│   │   │   ├── CheckService.ts       # joriy va yakuniy check
│   │   │   ├── PdfService.ts         # PDFKit: nakladnoy, shartnoma, check
│   │   │   ├── NotifyService.ts      # Grammy orqali xabar yuborish
│   │   │   ├── DebtService.ts        # qarzdorlar, eslatmalar
│   │   │   └── ReportService.ts      # oylik/kunlik hisobot
│   │   │
│   │   ├── jobs/
│   │   │   └── overdueCheck.ts       # cron: har kuni overdue tekshiradi
│   │   │
│   │   ├── utils/
│   │   │   ├── dateHelpers.ts        # kunlar hisoblash
│   │   │   ├── rentalNumber.ts       # ARN-2025-0001 generatsiya
│   │   │   └── formatMoney.ts        # 1000000 → "1,000,000 so'm"
│   │   │
│   │   ├── types/
│   │   │   ├── express.d.ts          # req.user type extension
│   │   │   └── index.ts              # umumiy typlar
│   │   │
│   │   └── app.ts                    # Express setup, middleware, routes
│   │
│   ├── .env
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   ├── fly.toml
│   └── Dockerfile
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx                # root layout, QueryProvider, TelegramInit
│   │   ├── page.tsx                  # Dashboard (bosh sahifa)
│   │   │
│   │   ├── rentals/
│   │   │   ├── page.tsx              # Arendalar ro'yxati
│   │   │   ├── new/
│   │   │   │   └── page.tsx          # Yangi arenda formi
│   │   │   └── [id]/
│   │   │       ├── page.tsx          # Arenda detail
│   │   │       ├── return/
│   │   │       │   └── page.tsx      # Jihoz qaytarish
│   │   │       └── check/
│   │   │           └── page.tsx      # Joriy/yakuniy check
│   │   │
│   │   ├── clients/
│   │   │   ├── page.tsx              # Mijozlar ro'yxati
│   │   │   ├── new/
│   │   │   │   └── page.tsx          # Yangi mijoz
│   │   │   └── [id]/
│   │   │       └── page.tsx          # Mijoz detail + arendalar tarixi
│   │   │
│   │   ├── equipment/
│   │   │   ├── page.tsx              # Jihozlar (category bo'yicha)
│   │   │   └── [id]/
│   │   │       └── page.tsx          # Jihoz detail
│   │   │
│   │   ├── debts/
│   │   │   └── page.tsx              # Qarzdorlar ro'yxati
│   │   │
│   │   ├── reports/
│   │   │   └── page.tsx              # Oylik/kunlik hisobot
│   │   │
│   │   └── settings/
│   │       └── page.tsx              # Admin: kompaniya ma'lumotlari, xodimlar
│   │
│   ├── components/
│   │   ├── ui/                       # shadcn komponentlari
│   │   │
│   │   ├── layout/
│   │   │   ├── BottomNav.tsx         # Pastki navigatsiya (mobil)
│   │   │   └── PageHeader.tsx        # Sarlavha + back button
│   │   │
│   │   ├── rental/
│   │   │   ├── RentalCard.tsx        # Arenda kartochkasi
│   │   │   ├── RentalForm.tsx        # Yangi arenda formi
│   │   │   ├── RentalStatusBadge.tsx # active/overdue/completed badge
│   │   │   ├── ReturnForm.tsx        # Qaytarish formi
│   │   │   └── CheckView.tsx         # Check ko'rinishi
│   │   │
│   │   ├── client/
│   │   │   ├── ClientCard.tsx
│   │   │   ├── ClientForm.tsx
│   │   │   └── ClientRentalHistory.tsx
│   │   │
│   │   ├── equipment/
│   │   │   ├── CategoryCard.tsx
│   │   │   └── EquipmentForm.tsx
│   │   │
│   │   └── shared/
│   │       ├── SearchInput.tsx
│   │       ├── MoneyDisplay.tsx      # 1500000 → "1 500 000 so'm"
│   │       ├── DateDisplay.tsx
│   │       ├── EmptyState.tsx
│   │       ├── LoadingSkeleton.tsx
│   │       └── ConfirmDialog.tsx
│   │
│   ├── hooks/
│   │   ├── useTelegramWebApp.ts      # Telegram WebApp SDK wrapper
│   │   ├── useAuth.ts                # token boshqarish
│   │   ├── useRentals.ts             # React Query hooks
│   │   ├── useClients.ts
│   │   ├── useEquipment.ts
│   │   └── useReports.ts
│   │
│   ├── lib/
│   │   ├── api.ts                    # Axios instance + interceptors
│   │   ├── queryKeys.ts              # React Query key factory
│   │   └── utils.ts                  # cn(), formatMoney(), formatDate()
│   │
│   ├── types/
│   │   └── index.ts                  # umumiy TypeScript typlar
│   │
│   ├── .env.local
│   ├── .env.example
│   ├── package.json
│   ├── tailwind.config.ts
│   └── next.config.ts
│
└── Docs/                             # Bu papka
    ├── 01-overview.md
    ├── 02-stack.md
    └── ...
```

---

## Environment Variables

### backend/.env
```env
# Server
NODE_ENV=development
PORT=5000

# MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/lesa-lego

# Telegram
BOT_TOKEN=7xxx:AAAxxx
WEBAPP_URL=https://lesa-lego.vercel.app

# JWT
JWT_SECRET=your-very-long-random-secret-here
JWT_EXPIRES_IN=7d

# Cron (overdue check)
CRON_SCHEDULE=0 9 * * *    # har kuni soat 09:00 da
```

### frontend/.env.local
```env
NEXT_PUBLIC_API_URL=https://lesa-lego-backend.fly.dev/api
NEXT_PUBLIC_BOT_USERNAME=lesa_lego_bot
```

---

## Package.json (backend)

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^8.0.0",
    "grammy": "^1.21.0",
    "zod": "^3.22.4",
    "jsonwebtoken": "^9.0.2",
    "pdfkit": "^0.14.0",
    "dayjs": "^1.11.10",
    "envalid": "^8.0.0",
    "cors": "^2.8.5",
    "node-cron": "^3.0.3",
    "crypto-js": "^4.2.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "tsx": "^4.7.0",
    "nodemon": "^3.0.0"
  },
  "scripts": {
    "dev": "nodemon --exec tsx src/app.ts",
    "build": "tsc",
    "start": "node dist/app.js"
  }
}
```

## Package.json (frontend)

```json
{
  "dependencies": {
    "next": "14.0.4",
    "react": "^18",
    "react-dom": "^18",
    "@tanstack/react-query": "^5.17.0",
    "react-hook-form": "^7.49.0",
    "@hookform/resolvers": "^3.3.3",
    "zod": "^3.22.4",
    "axios": "^1.6.5",
    "date-fns": "^3.0.6",
    "lucide-react": "^0.309.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  }
}
```