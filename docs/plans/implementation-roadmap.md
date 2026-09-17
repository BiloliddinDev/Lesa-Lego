# Backend Implementatsiya Yo'l Xaritasi

## Hozirgi holat

> ⚠️ Bu hujjat uzoq vaqt "100% tayyor" deb turdi, amalda esa quyidagilar
> bajarilmagan edi: worker ruxsatlari yarim yo'lda, qarz avtomatikasi yo'q,
> mijozga xabar yo'q. 17.09.2026 dagi auditda topilib tuzatildi —
> batafsil: `docs/status-report.md`.
>
> **Baholashda ehtiyot bo'ling:** `npm run verify` va `tsc --noEmit` faqat
> sof funksiyalar va tiplarni tekshiradi. Baza bilan ishlaydigan mantiq
> (ruxsatlar, qarz sanog'i, cron) qo'lda sinalishi shart.

### Modullar holati

### TAYYOR (ishlayotgan)
- Auth (Telegram login + JWT)
- Users (CRUD + self-service + audit query)
- Categories (CRUD)
- Equipment (CRUD + adjustQuantity)
- Clients (CRUD + search/filter)
- Rentals (create + return + close + check + PATCH)
- Payments (create + delete + Rental.paidAmount avtomatik yangilanish)
- **Debts (create + pay + avtomatik Payment yaratish)**
- **Settings (singleton CRUD)**
- **Reports (summary + monthly + overdue — aggregation pipelines)**
- **PDF Generation (nakladnoy + check — PDFKit)**
- **Bot Notifications (Grammy — rental/payment/overdue xabarlar)**
- **Cron Jobs (har kuni 09:00 overdue tekshirish)**

### MUAMMOLAR (tuzatildi)
- Equipment "available" filter — `$expr` bilan ishlaydi
- Client `createdBy` — route dan o'tkaziladi
- User stats — real hisob (Rental/Payment/AuditLog count)
- Audit Log — rental/payment/settings/debt ga yoziladi
- Morgan middleware — o'rnatildi
- req.user.id → req.user._id — tuzatildi
- Role comparison "admin" → "ADMIN" — tuzatildi
- Swagger — barcha 28 ta endpoint + 16 ta schema qamrab olgan

---

## KEYINGI QADAMLAR (dependency tartibida)

---

## QADAM 1: Payments (To'lovlar)

**Status:** `done`
**Qiyinlik:** O'rtacha
**Dependency:** Yo'q (model tayyor)

### Nimani qilish kerak:
1. `services/payment.service.ts` — yaratish
   - `getAll(filters)` — rentalId, clientId, method, from/to, pagination
   - `create(data, userId)` — to'lov yaratish + Rental.paidAmount yangilash + Client.totalDebt yangilash + AuditLog
   - `delete(id)` — to'lovni bekor qilish (admin only) + Rental.paidAmount qayta hisob + Client.totalDebt yangilash + AuditLog

2. `routes/payment.routes.ts` — yaratish
   - `GET /` — barcha to'lovlar (admin: hammasi, worker: faqat o'ziniki)
   - `POST /` — yangi to'lov (admin + worker)
   - `DELETE /:id` — to'lovni bekor qilish (faqat admin)

3. `app.ts` ga qo'shish — `app.use("/api/payments", paymentRoutes)`

### API Endpoints (docs/api-endpoints.md ga muvofiq):
```
GET    /payments              ?rentalId=&clientId=&method=&from=&to=&page=&limit=
POST   /payments              { rentalId, amount, method, note }
DELETE /payments/:id          (admin only)
```

### Xususiyatlari:
- To'lov yaratilganda `Rental.paidAmount` avtomatik oshadi
- To'lov bekor qilinsa `Rental.paidAmount` avtomatik kamayadi
- Har bir amal `AuditLog` ga yoziladi
- `Client.totalDebt` har doim yangilanadi

---

## QADAM 2: Debts (Qarzdorlar)

**Status:** `done`
**Qiyinlik:** Oson
**Dependency:** Qadamm 1 (Payments)

### Nimani qilish kerak:
1. `services/debt.service.ts` — yaratish
   - `getAll(filters)` — status, clientId, pagination
   - `create(data)` — arenda yopilganda qarz qayd etish
   - `pay(id, data)` — qarzni to'lash (payment yaratish + debt status yangilash)

2. `routes/debt.routes.ts` — yaratish
   - `GET /` — qarzdorlar ro'yxati
   - `POST /` — yangi qarz qayd etish
   - `POST /:id/pay` — qarzni to'lash

3. `app.ts` ga qo'shish — `app.use("/api/debts", debtRoutes)`

### API Endpoints:
```
GET    /debts                 ?status=pending|paid|overdue&clientId=&page=&limit=
POST   /debts                 { clientId, rentalId, amount, dueDate, note }
POST   /debts/:id/pay         { amount, method, note }
```

### Xususiyatlari:
- `POST /debts/:id/pay` — avtomatik Payment yaratadi
- Debt status: pending → paid (to'lov qilinganda) yoki overdue (muddati o'tganda)

---

## QADAM 3: Settings (Kompaniya sozlamalari)

**Status:** `done`
**Qiyinlik:** Oson
**Dependency:** Yo'q

### Nimani qilish kerak:
1. `services/settings.service.ts` — yaratish
   - `get()` — singleton — bitta hujjatni olish (yo'q bo'lsa yaratish)
   - `update(data)` — sozlamalarni yangilash

2. `routes/settings.routes.ts` — yaratish
   - `GET /` — sozlamalarni olish (admin only)
   - `PATCH /` — sozlamalarni yangilash (admin only)

3. `app.ts` ga qo'shish — `app.use("/api/settings", settingsRoutes)`

### API Endpoints:
```
GET    /settings              (admin only)
PATCH  /settings              { companyName, ownerName, address, phone, inn, bankAccount, bankName, ... }
```

### Xususiyatlari:
- Singleton pattern — faqat bitta hujjat
- Logo, pechat, imzo — base64 saqlanadi (rasmlar keyin qo'shiladi)
- PDF generatsiya uchun asosiy ma'lumot manbai

---

## QADAM 4: Reports (Hisobotlar)

**Status:** `done`
**Qiyinlik:** O'rtacha
**Dependency:** Qadamm 1 (Payments) + Qadamm 2 (Rentals tayyor)

### Nimani qilish kerak:
1. `services/report.service.ts` — yaratish
   - `getSummary()` — dashboard uchun umumiy statistika
   - `getMonthly(year, month)` — oylik hisobot
   - `getOverdue()` — muddati o'tgan arendalar

2. `routes/report.routes.ts` — yaratish
   - `GET /summary` — dashboard (admin only)
   - `GET /monthly` — oylik hisobot (admin only)
   - `GET /overdue` — muddati o'tganlar (admin + worker)

3. `app.ts` ga qo'shish — `app.use("/api/reports", reportRoutes)`

### API Endpoints:
```
GET    /reports/summary       (admin only)
GET    /reports/monthly       ?year=&month= (admin only)
GET    /reports/overdue       (admin + worker)
```

### Aggregation pipelines:
- **Summary:** active rentals count, overdue count, total debtors, equipment stats, today's activity
- **Monthly:** revenue, new/closed rentals, top clients, top equipment, daily revenue chart
- **Overdue:** rentals WHERE expectedEndDate < today AND status = "active"

---

## QADAM 5: PDF Generation

**Status:** `done`
**Qiyinlik:** O'rtacha
**Dependency:** Qadamm 3 (Settings) + Rental + Payment data

### Nimani qilish kerak:
1. `services/pdf.service.ts` — yaratish
   - `generateNakladnoy(rental)` — jihozlar chiqarish varag'i
   - `generateCheck(rental)` — joriy hisob
   - `generateContract(rental)` — shartnoma

2. `routes/pdf.routes.ts` — yaratish
   - `GET /:id/pdf?type=nakladnoy|check|contract` — PDF yuklab olish

3. PDFKit layout:
   - Kompaniya ma'lumotlari (Settings dan)
   - Mijoz ma'lumotlari (Rental.client dan)
   - Jihozlar jadvali (Rental.items dan)
   - Imzo/pechat joylari

### API Endpoints:
```
GET    /rentals/:id/pdf      ?type=nakladnoy|check|contract
```

---

## QADAM 6: Bot Notifications

**Status:** `done`
**Qiyinlik:** Oson
**Dependency:** Grammy o'rnatilgan

### Nimani qilish kerak:
1. `bot/index.ts` — yaratish
   - Grammy botni ishga tushirish
   - `/start` — start tugmasi

2. `services/notify.service.ts` — yaratish
   - `rentalCreated(rental)` — admin ga xabar
   - `rentalClosed(rental)` — admin ga xabar
   - `paymentReceived(payment)` — admin ga xabar
   - `overdueAlert(rental)` — admin + client ga xabar

3. Integration:
   - `rental.service.ts` — createRental, closeRental dan chaqirish
   - `payment.service.ts` — create dan chaqirish

### Xabar formatlari:
```
🆕 Yangi arenda: ARN-2025-0013
Mijoz: Vohid Rahimov
Jihozlar: 8x Lesa A-seriya
Boshlanish: 2025-06-29

✅ Arenda yopildi: ARN-2025-0005
Umumiy: 455,000 so'm
To'lov: 200,000 so'm
Qarz: 255,000 so'm

💰 To'lov: 300,000 so'm
Arenda: ARN-2025-0005
Usul: Naqd

⚠️ Muddati o'tdi: ARN-2025-0003
3 kun o'tdi | Qarz: 850,000 so'm
```

---

## QADAM 7: Cron Jobs

**Status:** `done`
**Qiyinlik:** Oson
**Dependency:** Qadamm 6 (Bot notifications)

### Nimani qilish kerak:
1. `jobs/overdue-check.ts` — yaratish
   - Har kuni 09:00 da ishlaydi
   - Barcha active rental larni tekshiradi
   - expectedEndDate < today bo'lsa → status "overdue" ga o'zgartiradi
   - Admin ga bot xabar yuboradi

2. `app.ts` ga qo'shish — cron job ni ishga tushirish

### Logika:
```
Har kuni 09:00:
  → Rental.find({ status: "active", expectedEndDate: { $lt: new Date() } })
  → Har birini status = "overdue" ga o'zgartirish
  → NotifyService.overdueAlert(rental) — admin ga xabar
```

---

## UMUMIY JADVAL

| Qadam | Modul | Status |
|-------|-------|--------|
| 1 | Payments | done |
| 2 | Debts | done |
| 3 | Settings | done |
| 4 | Reports | done |
| 5 | PDF Generation | done |
| 6 | Bot Notifications | done |
| 7 | Cron Jobs | done |

---

## TEXNIK QOIDALAR

1. **Har bir qadam** — avval service, keyin route, keyin app.ts ga qo'shish
2. **Audit Log** — har bir muhim operatsiya (create, update, delete, payment) ga yozilishi shart
3. **Error handling** — AppError dan foydalanish, to'g'ri status code
4. **Validation** — Zod schema ishlatish (validation papkasida tayyor)
5. **Build check** — har bir qadamdan keyin `npx tsc --noEmit` ishga tushirish
6. **Soft delete** — client, equipment, category uchun (isActive: false)
7. **Pagination** — barcha list endpointlarda page/limit/totalPages
