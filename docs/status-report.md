# 📋 Lesa-Lego — Loyiha Status Report

> **Sana:** 17 Sentabr, 2026
> **Loyiha:** Qurilish jihozlarini ijaraga berish boshqaruv tizimi (Telegram WebApp)
>
> ⚠️ Bu hujjat 27.07.2026 dagi versiyada "Backend 90% / Frontend 85%" deb
> turgan, lekin o'sha paytdayoq to'g'ri bo'lmagan: qarz avtomatikasi, worker
> ruxsatlari va mijozga xabar yozilmagan edi. Quyida — auditdan keyingi
> HAQIQIY holat.

---

## 1. 📊 Umumiy holat

| Bo'lim | Holat | Izoh |
|--------|-------|------|
| **Hisob-kitob yadrosi** | ✅ Ishonchli | `rental-calc` — yagona manba, `npm run verify` bilan qoplangan |
| **Backend API** | ✅ To'liq | 10 modul, ruxsatlar backendda majburlangan |
| **Qarz/nasiya oqimi** | ✅ Avtomatik | Yopishda avto-qarz, muddat croni, eslatmalar |
| **Frontend** | 🟡 Ishlaydi | Barcha asosiy sahifalar bor; ba'zi yangi maydonlar UI'da yo'q (5-bo'lim) |
| **Baza bilan sinov** | ❌ Qilinmagan | Eng katta bo'shliq — 6-bo'limga qarang |

---

## 2. 🔧 17.09.2026 auditida tuzatilganlar

### 2.1 Ruxsatlar (xavfsizlik)
| Muammo | Holat |
|--------|-------|
| `POST /rentals/:id/return` va `/close` — egalik tekshiruvi yo'q edi, worker begona arendani yopardi | ✅ tuzatildi |
| `POST /payments` — worker begona arendaga to'lov kiritardi | ✅ tuzatildi |
| `POST /debts`, `/debts/:id/pay` — tekshiruvsiz edi | ✅ tuzatildi |
| `GET /payments`, `GET /debts` — har qanday xodim butun kassa oborotini ko'rardi | ✅ o'zi ochgan arendalar doirasiga cheklandi |
| `GET /reports/overdue`, `/equipment/:id/history` — begona mijozlar ma'lumoti ochiq edi | ✅ cheklandi |
| Oxirgi faol adminni bloklash mumkin edi (tizimga kirish yo'qolardi) | ✅ taqiqlandi |

Yagona manba: `services/access.service.ts`.

### 2.2 Pul va qarz
| Muammo | Holat |
|--------|-------|
| Arenda yopilishi bilan mijoz qarzi `totalDebt` dan YO'QOLARDI | ✅ barcha arendalar sanaydi (yopilgan arenda hisobi `endDate` da muzlaydi) |
| `reconcileAll()` server ko'tarilganda o'sha qarzlarni nolga tushirardi | ✅ filtr olib tashlandi |
| Arenda yopilganda `Debt` hujjati ochilmasdi (qo'lda kerak edi) | ✅ avtomatik (`debtDueDate` ixtiyoriy) |
| `Debt.dueDate` o'qilmasdi: na eslatma, na `overdue` holati | ✅ cron (09:00, APP_TZ): 2 kun oldin eslatma + muddat o'tganda `overdue` |
| To'lovdan keyin qarz hujjati "pending" bo'lib osilib qolardi | ✅ `debt-status.service.ts` moslaydi (ikki tomonlama) |

### 2.3 Boshqa buglar
| Muammo | Holat |
|--------|-------|
| **Telegram ID siz ikkinchi mijozni yaratib bo'lmasdi** — `{telegramId: undefined}` Mongoose'da `{}` ga aylanib, `$or` ichida hamma hujjatga mos kelardi (har safar 409) | ✅ tuzatildi |
| `PATCH /equipment/:id` orqali ombor miqdorini band jihozlardan kam qilish mumkin edi | ✅ tekshiruv qo'shildi |
| Frontend 401 da mavjud bo'lmagan `/login` ga yo'naltirardi (404) | ✅ `/` ga |
| `JWT_EXPIRES_IN` sozlamasi e'tiborga olinmasdi (qattiq "7d") | ✅ env dan |
| Arenda raqamidagi yil server TZ'idan olinardi (31-dekabr kechasi noto'g'ri yil) | ✅ APP_TZ dan |
| Telegram hash oddiy `===` bilan solishtirilardi | ✅ `timingSafeEqual` |
| Qidiruv matni to'g'ridan-to'g'ri `$regex` ga tushardi | ✅ ekranlanadi |
| Jihozi bor kategoriyani o'chirish mumkin edi | ✅ taqiqlandi |
| Nakladnoy 1 nusxa edi (plan: 2 nusxa) | ✅ Beruvchi + Oluvchi sahifalari |
| Xavfsizlik header'lari va so'rov chegarasi yo'q edi | ✅ helmet + rate-limit (login: 20/15daq, API: 300/daq) |

---

## 3. 🏗 Backend — mavjud imkoniyatlar

- **Modellar (9):** User, Category, Equipment, Client, Rental, Payment, Debt, AuditLog, CompanySettings
- **Auth:** Telegram initData (HMAC + 24 soat muddat) + JWT; dev-login faqat `NODE_ENV=development` da
- **API:** Categories, Equipment, Clients, Rentals, Payments, Debts, Settings, Reports, Users
- **Hisob-kitob:** `rental-calc` — kunlik jadval, segmentlar, qarz/ortiqcha to'lov; barcha kun chegaralari `APP_TZ` bo'yicha
- **Ombor:** atomik band qilish (`$expr` + `$inc`), server startida `reconcileAll()` avtomatik tuzatish
- **PDF:** nakladnoy (2 nusxa), chek, shartnoma — summalar `rental-calc` dan
- **Bot:** Grammy; adminlarga arenda/to'lov/muddat xabarlari, mijozga qarz va muddat eslatmasi
- **Cron:** har kuni 09:00 (APP_TZ) — arenda muddati + qarz muddati
- **Audit:** har bir muhim amal `AuditLog` ga

## 4. 🎨 Frontend — mavjud sahifalar

Login (`/`, Telegram avto-kirish + dev rejim), Dashboard, Arendalar (ro'yxat/yangi/detal, PDF yuklab olish), Mijozlar (ro'yxat/yangi/detal + tahrirlash), Ombor (kategoriya tablar, tez arenda, tarix, tahrirlash), To'lovlar, Qarzdorlar, Kategoriyalar, Xodimlar, Sozlamalar, Hisobotlar (summary/oylik/overdue).

Stack: Next.js 16, React 19, Tailwind v4, shadcn/ui, TanStack Query, RHF + Zod, Axios.

---

## 5. ❌ Hali qilinmagan

### 5.1 Frontend
| # | Nima | Muhimlik |
|---|------|----------|
| 1 | **Logotip / pechat / imzo rasmi** — `CompanySettings` da maydon bor, PDF'ga chizilmaydi, yuklash oynasi ham yo'q | 🟠 O'rta |
| 2 | Rate-limit (429) xatosi uchun alohida xabar | 🟢 Past |

> Yopilganlar (17.09.2026): qarz muddati maydoni, ombor miqdorini sozlash
> oynasi, xodim audit tarixi, hujjatni Telegramga yuborish tugmasi, mijoz
> qidiruvi (arenda ochish oynalarida), mijoz Telegram ID/manzil maydonlari.

### 5.2 Backend / umumiy
| # | Nima | Muhimlik |
|---|------|----------|
| 1 | **Avtomatik testlar yo'q** — faqat `npm run verify` (sof funksiyalar) | 🟠 O'rta |
| 2 | Tranzaksiya (multi-document) ishlatilmaydi — o'rniga post-commit + `reconcileAll()` | 🟡 Past |
| 3 | Deploy (Fly.io/Vercel) sozlanmagan | 🟠 O'rta |
| 4 | Onlayn to'lov, multi-filial, inventarizatsiya — ataylab scope'dan tashqarida | — |

---

## 6. 🧪 Sinov holati — MUHIM

```bash
cd backend && npm run verify      # rental-calc + utils (sof funksiyalar)
cd backend && npx tsc --noEmit    # tiplar
cd frontend && npx tsc --noEmit   # tiplar
```

Bularning hammasi ✅ o'tadi. **Lekin ular bazaga bog'liq mantiqni
tekshirmaydi.** Ruxsat doiralari, qarz sanog'i, avto-qarz va cron hech qachon
haqiqiy baza bilan ishlatib ko'rilmagan.

**Tavsiya etilgan qo'lda sinov (dev bazada, admin + worker bilan):**

1. Worker mijoz qo'shadi (Telegram ID siz — ikkitasini ketma-ket, 409 chiqmasligi kerak)
2. Worker arenda ochadi → ombor soni kamayadi
3. Boshqa worker o'sha arendani yopishga urinadi → **403**
4. Qisman qaytarish → chek summasi kamayadi, ombor qisman qaytadi
5. Yopish (qarz qoldirib, `debtDueDate` bilan) → `Debt` avtomatik ochiladi, `totalDebt` saqlanadi
6. To'lov kiritish → qarz kamayadi, to'liq to'langanda `Debt` "paid" ga o'tadi
7. Admin to'lovni bekor qiladi → qarz qaytadi, `Debt` "pending" ga qaytadi
8. Serverni qayta ishga tushirish → `[Reconcile]` logida "0 jihoz tuzatildi" bo'lishi kerak

**Telegram va PDF (alohida sinaladi — kod darajasida tayyor, ishlatib ko'rilmagan):**

9. Arenda ochish → adminlar chatiga nakladnoy PDF avtomatik kelishi kerak
10. Arenda sahifasi → PDF → "Adminlarga" / "Mijozga ham" tugmalari
11. Mijozda Telegram ID yo'q bo'lsa "Mijozga ham" → 400 va tushunarli xabar
12. Shartnoma PDF'da bank rekvizitlari (INN, bank, hisob raqam) ko'rinishi
13. Nakladnoy PDF — 2 sahifa: "Beruvchi nusxasi" va "Oluvchi nusxasi"

---

*Oxirgi yangilanish: 17.09.2026 auditi. O'zgarish kiritsangiz — shu hujjatni ham yangilang.*
