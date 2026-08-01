# 📋 Lesa-Lego — Loyiha Status Report

> **Sana:** 27 Iyul, 2026
> **Loyiha:** Qurilish jihozlarini ijaraga berish boshqaruv tizimi (Telegram WebApp)

---

## 1. 📊 Umumiy holat

| Bo'lim | Holat | Izoh |
|--------|-------|------|
| **Backend** | ✅ To'liq (90%) | Barcha modellar, routelar, servislar, validatsiyalar, middleware |
| **Frontend** | ✅ To'liq (85%) | Barcha sahifalar, komponentlar, hooklar, auth, layout |
| **Integratsiya** | ✅ Ishlaydi | Backend ↔ Frontend bog'langan, JWT auth |
| **Dev-auth** | ✅ Ishlaydi | Dev-login, dev-setup, dev-users — faqat development muhitida |

---

## 2. 🏗 Backend — Bajarilgan

### 2.1 Modellar (9 ta)
- ✅ `User` — telegramId, name, role (ADMIN/WORKER), isActive
- ✅ `Category` — name, description, order, isActive
- ✅ `Equipment` — category ref, name, totalQuantity, rentedQuantity, dailyRate
- ✅ `Client` — fullName, phone, telegramId, totalDebt, isActive
- ✅ `Rental` — rentalNumber (ARN-2025-XXXX), items[], status, deposit, paid
- ✅ `Payment` — rental ref, client ref, amount, method (cash/card/transfer)
- ✅ `Debt` — client ref, rental ref, amount, dueDate, status
- ✅ `AuditLog` — userId, action, resourceType, before/after
- ✅ `CompanySettings` — companyName, logo, stamp, signature, template

### 2.2 Middleware
- ✅ `authMiddleware` — JWT verify, user load
- ✅ `requireAdmin` — role check
- ✅ `validate` — Zod schema validation
- ✅ `errorHandler` — global error handler

### 2.3 Auth
- ✅ Telegram initData login
- ✅ `POST /api/auth/dev-login` — Development login (existing user)
- ✅ `POST /api/auth/dev-setup` — Development setup (birinchi admin yaratish)
- ✅ `GET /api/auth/dev-users` — Development users list
- ✅ `GET /api/auth/me` — Joriy user ma'lumoti
- ✅ `PATCH /api/auth/me` — O'z ma'lumotini yangilash

### 2.4 API Endpoints (to'liq CRUD)
- ✅ **Categories** — GET, POST, PATCH, DELETE (Admin CRUD)
- ✅ **Equipment** — GET, POST, PATCH, DELETE + `/:id/quantity` + `/:id/history`
- ✅ **Clients** — GET, POST, PATCH, DELETE (search, pagination)
- ✅ **Rentals** — GET, POST, `/:id/return`, `/:id/close`, `/:id/pdf`, `/:id/check`
- ✅ **Payments** — GET, POST, DELETE
- ✅ **Debts** — GET, POST, `/:id/pay`
- ✅ **Settings** — GET, PATCH (Admin only)
- ✅ **Reports** — `/summary`, `/overdue` (Admin only)
- ✅ **Users** — GET, POST, PATCH, `/:id/audit` (Admin only)

### 2.5 Services
- ✅ **rental.service** — create, return (qisman qaytarish), close (to'liq yopish), check (segment-based hisob-kitob), equipmentHistory
- ✅ **payment.service** — create, delete (rental.paidAmount + client.totalDebt update)
- ✅ **debt.service** — create, pay (debt + payment bir vaqtda)
- ✅ **pdf.service** — Nakladnoy, Check generatsiya
- ✅ **notify.service** — Telegram bot xabarlari
- ✅ **report.service** — dashboard summary, overdue list
- ✅ **equipment.service** — adjustQuantity (AuditLog bilan)
- ✅ **user.service** — worker CRUD, audit log

### 2.6 Qo'shimcha
- ✅ **Bot** — Grammy.js, /start → WebApp link, notifications
- ✅ **Cron job** — overdue-check (har kuni)
- ✅ **Swagger** — `/api-docs` da to'liq dokumentatsiya
- ✅ **Role-based access** — Worker faqat o'z arendalarini ko'radi (backend enforced)

---

## 3. 🎨 Frontend — Bajarilgan

### 3.1 Foundation
- ✅ **Tech stack** — Next.js 16, React 19, Tailwind CSS v4, shadcn/ui
- ✅ **shadcn components** — button, input, card, dialog, badge, separator, select, label, textarea, skeleton, avatar, tabs
- ✅ **API client** — Axios with interceptors (auto-token, 401 redirect)
- ✅ **Types** — Barcha TypeScript interfacelar
- ✅ **Auth context** — useAuth hook (dev-login/dev-setup)
- ✅ **QueryClient** — TanStack Query provider
- ✅ **Utils** — cn(), formatCurrency(), formatDate(), formatDateTime()

### 3.2 Pages
| Page | Yo'nalish | Xususiyatlari |
|------|-----------|---------------|
| `/` | Login | Dev-login + dev-setup, user select |
| `/dashboard` | Dashboard | Admin: summary stats, Worker: o'z arendalari |
| `/rentals` | Arendalar | List + filter (status, createdBy) |
| `/rentals/new` | Yangi arenda | react-hook-form + zod, item qo'shish |
| `/rentals/[id]` | Arenda detail | Status, items, return/close/payment actions |
| `/clients` | Mijozlar | List + search + pagination |
| `/clients/new` | Yangi mijoz | Form |
| `/clients/[id]` | Mijoz detail | Ma'lumot + arendalar tarixi |
| `/equipment` | Ombor | Category tabs, grid, ijaraga berish, tarix, edit |
| `/payments` | To'lovlar | List + create (Admin) |
| `/debts` | Qarzdorlar | List + to'lash dialog |
| `/categories` | Kategoriyalar | Admin CRUD |
| `/workers` | Xodimlar (Admin) | List + create + block/unblock |
| `/settings` | Sozlamalar (Admin) | Company info, logo, stamp |
| `/reports` | Hisobotlar (Admin) | Summary + overdue list |

### 3.3 Layout
- ✅ **AppLayout** — Mobil-friendly bottom navigation
- ✅ **Role-based nav** — Admin barchasini ko'radi, Worker faqat o'ziga keraklisini
- ✅ **Admin-only** — Workers, Categories, Settings, Reports sahifalari

### 3.4 Warehouse (Ombor) mode
- ✅ "Ijaraga berish" tugmasi har bir karta uchun
- ✅ Tez arenda dialogi (mijoz, miqdor, start, deposit)
- ✅ Miqdor validatsiyasi (max cheklov, backend tekshirish)
- ✅ Mavjud/band miqdor ko'rsatish
- ✅ **Harakatlar tarixi** dialogi (rentalNumber, client, sana, qaytarilgan/qaytarilmagan)
- ✅ **Edit dialog** — name, description, dailyRate, totalQuantity, isActive

### 3.5 Security (Frontend)
- ✅ Admin-only tugmalar yashirilgan
- ✅ Worker faqat o'z arendalarini ko'radi (createdBy filter)
- ✅ Login page — token bilan avtomatik yo'naltirish
- ✅ 401 interceptor — avtomatik logout

---

## 4. ✅ Ishlayotgan xususiyatlar

1. **Dev auth** — Login, user yaratish, token olish
2. **Ombor** — Jihozlarni ko'rish, kategoriya filter, qidirish
3. **Ijara berish** — Tez arenda (ombordan), yangi arenda (rentals/new)
4. **Arenda yopish** — Qisman qaytarish (return), to'liq yopish (close)
5. **To'lov** — To'lov kiritish (Admin), rental.paidAmount update
6. **Qarzdorlar** — Qarz ko'rish, to'lash
7. **Mijoz** — Qo'shish, ko'rish, qidirish
8. **Kategoriya** — CRUD
9. **Xodimlar** — Qo'shish, block/unblock
10. **Harakatlar tarixi** — Har bir jihoz uchun
11. **Edit jihoz** — name, description, narx, miqdor, faol/faolsiz
12. **Dashboard** — Admin summary, Worker o'z arendalari
13. **Hisobotlar** — Summary + overdue (Admin)
14. **Role management** — Admin/Worker farqi (frontend + backend)

---

## 5. ❌ Yetishmayotgan / To'liq emas

### 5.1 Frontend
| # | Feature | Muhimlik | Izoh |
|---|---------|----------|------|
| 1 | **Clients edit** | 🟡 O'rta | PATCH /clients/:id endpoint bor, lekin frontend edit dialog yo'q |
| 2 | **Equipment miqdor sozlash (adjustQuantity)** | 🟡 O'rta | Backend endpoint bor, frontend dialog yo'q (sabab bilan) |
| 3 | **Clients detail page** | 🟢 Past | Mijoz arendalari ro'yxati oddiy, filter yo'q |
| 4 | **Rental detail page** | 🟢 Past | Return/close/payment UX ni yaxshilash mumkin |
| 5 | **Backend validation** | 🟢 Past | `updateEquipment` da totalQuantity >= rentedQuantity tekshirilmaydi |
| 6 | **PDF download** | 🟡 O'rta | Backend endpoint bor, frontend da download tugmasi yo'q |
| 7 | **Notifications** | 🟢 Past | Bot notification uchun UI yo'q |
| 8 | **Loading states** | 🟢 Past | Ba'zi joylarda loading/error states yaxshilash mumkin |
| 9 | **Telegram WebApp integration** | 🔴 Muxim | Hozircha faqat dev-mode, Telegram initData auth yozilmagan |
| 10 | **Deployment** | 🔴 Muxim | Fly.io / Vercel deploy qilinmagan |

### 5.2 Backend
| # | Feature | Muhimlik | Izoh |
|---|---------|----------|------|
| 1 | **Telegram initData auth** | 🔴 Muxim | Hozircha faqat dev-login, Telegram WebApp auth yo'q |
| 2 | **updateEquipment validation** | 🟢 Past | totalQuantity >= rentedQuantity tekshirilmaydi |
| 3 | **admin audit log** | 🟢 Past | AuditLog'dan foydalanuvchi admin paneli yo'q |
| 4 | **Client totalDebt calculation** | 🟢 Past | Hozir manual, rental.paidAmount ga qarab auto hisoblanmaydi |
| 5 | **Tests** | 🟢 Past | Unit testlar yo'q |

---

## 6. 🧱 Stack (joriy)

```
Backend:
  Node.js + Express + TypeScript
  MongoDB + Mongoose
  Zod (validation)
  JWT (auth)
  Grammy.js (Telegram bot)
  PDFKit (PDF generatsiya)
  node-cron

Frontend:
  Next.js 16 + React 19 + TypeScript
  Tailwind CSS v4
  shadcn/ui (manually created)
  TanStack Query v5
  React Hook Form + Zod
  Axios
  Lucide React (icons)
  Sonner (toast)
  date-fns
  recharts (dashboard charts)
```

---

## 7. 📁 Fayl strukturasi (qisqacha)

```
lesa-lego/
├── backend/
│   ├── src/
│   │   ├── app.ts              # Express setup, routes
│   │   ├── bot/                # Telegram bot (Grammy)
│   │   ├── config/             # DB, env, swagger
│   │   ├── jobs/               # Cron (overdue check)
│   │   ├── middleware/         # auth, validate, errorHandler
│   │   ├── models/             # 9 ta model
│   │   ├── routes/             # 10 ta route file
│   │   ├── services/           # 12 ta service
│   │   ├── types/              # express.d.ts, auth.types
│   │   ├── utils/              # AppError, jwt, telegramAuth
│   │   └── validation/         # Zod schemas (9 ta)
│   └── docs/swagger.yaml       # API dokumentatsiya
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx            # Login
│   │   ├── layout.tsx          # Root layout
│   │   ├── providers.tsx       # QueryClient + Auth
│   │   ├── globals.css         # Tailwind CSS
│   │   ├── dashboard/          # Dashboard
│   │   ├── rentals/            # Arendalar (list, new, [id])
│   │   ├── clients/            # Mijozlar (list, new, [id])
│   │   ├── equipment/          # Ombor
│   │   ├── payments/           # To'lovlar
│   │   ├── debts/              # Qarzdorlar
│   │   ├── categories/         # Kategoriyalar (Admin)
│   │   ├── workers/            # Xodimlar (Admin)
│   │   ├── settings/           # Sozlamalar (Admin)
│   │   └── reports/            # Hisobotlar (Admin)
│   ├── components/
│   │   ├── ui/                 # shadcn komponentlar
│   │   └── layout/             # AppLayout
│   ├── hooks/                  # use-auth
│   └── lib/                    # api, types, utils, validations
│
└── docs/                       # Dokumentatsiya
```

---

## 8. 🎯 Keyingi qadamlar (tavsiya)

### Darhol qilish mumkin (kichik):
1. **Clients edit** — mijoz tahrirlash dialogi
2. **Equipment adjustQuantity** — sabab bilan miqdor sozlash
3. **Rental detail** — qaytarish va yopish UX ni yaxshilash

### Muhim (deploy uchun):
4. **Telegram initData auth** — real Telegram WebApp autentifikatsiya
5. **npm install + build** — frontend ni production build qilish

### Kelajak:
6. Unit testlar
7. Multi-branch qo'llab-quvvatlash
8. Onlayn to'lov (Payme/Click)
9. Ombor inventarizatsiyasi

---

*Hujjat avtomatik generatsiya qilingan. Agar biror narsa o'zgargan bo'lsa, yangilab turing.*
