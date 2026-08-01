# 🔗 Telegram WebApp Integrasiya va Deploy

> Ushbu hujjat Telegram WebApp orqali kirishni ishga tushirish uchun nima qilingan
> va nima qilish kerakligini tasvirlaydi.

---

## 📄 PDF hujjatlar (Deploy eslatmasi)

PDF'lar (`/rentals/:id/pdf?type=nakladnoy|check|contract`) DejaVu shriftlarini
ishlatadi: `backend/assets/fonts/DejaVuSans.ttf` va `DejaVuSans-Bold.ttf`
(Cyrillic + oʻzbek harflari uchun).

⚠️ **Deploy paytida shu fayllarni ham koʻchirish kerak:**
- Dockerfile boʻlsa: `COPY backend/assets /app/assets` (yoki mos yoʻl)
- `.dockerignore` / `.gitignore` da `assets` katalogi chiqarib tashlanmasin
- Shriftlar yoʻq boʻlsa tizim Helvetica ga tushadi — lotin harflari ishlaydi,
  lekin Cyrillic (А, Б, В...) va ʻ harflari buziladi

---

## ✅ Kodda qilingan ishlar

| Qism | Holat | Izoh |
|------|-------|------|
| `POST /api/auth/telegram` | ✅ | initData HMAC-SHA256 tekshirish, user topish, JWT qaytarish |
| `verifyTelegramWebAppData` | ✅ | Rasmiy Telegram algoritmi (hash, auth_date 24 soat) |
| **Ism sinxronizatsiyasi** | ✅ | Telegram'dan ism/username o'zgargan bo'lsa DB yangilanadi |
| **Auth response `name`** | ✅ | `fullName` → `name` (frontend `User` tipi bilan mos) |
| Frontend auto-login | ✅ | `window.Telegram.WebApp.initData` aniqlanganda avtomatik kirish |
| Bot `/start` + WebApp tugma | ✅ | Inline keyboard orqali ilova ochish |
| Bot chat menu button | ✅ | Bot chatidagi "Menyu" tugmasi WebApp'ni ochadi |

---

## 🚀 Deploy uchun tekshiruv ro'yxati

### 1. Frontend deploy (HTTPS shart!)

Telegram WebApp faqat **HTTPS** manzilda ishlaydi. Frontend'ni deploy qiling:

```
Frontend URL: https://lesa-lego.vercel.app   (masalan)
```

**Muhim env:**
```bash
# frontend/.env.production
NEXT_PUBLIC_API_URL=https://lesa-lego-backend.fly.dev/api
```

> ⚠️ Telegram WebApp `localhost` ni production'da qabul qilmaydi.
> Test uchun Telegram'ning o'z WebApp debugging (botdan URL jo'natish) ishlatiladi.

### 2. Backend deploy

```
Backend URL: https://lesa-lego-backend.fly.dev
```

**Muhim env:**
```bash
# backend/.env.production
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
BOT_TOKEN=123456:ABC...          # @BotFather dan
WEBAPP_URL=https://lesa-lego.vercel.app
JWT_SECRET=<kuchli maxfiy kalit>
PORT=5000
```

### 3. BotFather sozlash

1. [@BotFather](https://t.me/BotFather) ga `/mybots` yuboring
2. Bot'ni tanlang → **Bot Settings**
3. **Menu Button** → **Web App** → frontend URL'ni kiriting
   (Bu bot chatidagi "Menyu" tugmasi WebApp'ni ochadi)
4. **Domain** → `lesa-lego.vercel.app` ni qo'shing (Telegram foydalanuvchilar
   uchun ishonchli domendan ochilishi uchun)

> Bot kodi `setChatMenuButton` orqali ham menyu tugmasini avtomatik o'rnatadi,
> lekin BotFather'dan domain ro'yxatini tasdiqlash hali ham kerak.

### 4. DB da userlar

Telegram orqali kirish uchun user allaqachon DB'da bo'lishi kerak:

- **Admin**: dev-setup orqali yoki qo'lda (Telegram ID bilan)
- **Workerlar**: `/workers` sahifasida Admin qo'shadi (Telegram ID kerak)
- Foydalanuvchi Telegram ID'sini topish: [@userinfobot](https://t.me/userinfobot) ga `/start`

### 5. Sinov jarayoni

1. Backend va frontend deploy bo'lsin
2. Bot'ga /start yuboring → "🌐 Ilovani ochish" tugmasini bosing
3. WebApp ochilganda Telegram avtomatik login qiladi (ism, username DB da ko'rinadi)
4. Tizimga qo'shilmagan user WebApp'ni ochsa → "Kirish imkonsiz" ekran ko'rsatiladi

---

## 🔁 Auth oqimi (qisqacha)

```
Foydalanuvchi Telegram da WebApp ochadi
  → window.Telegram.WebApp.initData olinadi
  → Frontend: POST /api/auth/telegram { initData }
  → Backend: HMAC-SHA256 verify + user topish + ism sinxronizatsiya
  → JWT qaytariladi (7 kun)
  → Frontend har so'rovga Authorization: Bearer <token> qo'shadi
  → 401 bo'lsa avtomatik logout
```

---

## ❗ E'tibor bering

- Dev-mode (`dev-login`, `dev-setup`, `dev-users`) **faqat NODE_ENV=development**
  da ishlaydi — production'da bu endpointlar mavjud emas
- Brauzerda (Telegram'siz) ishlatilsa, login sahifasi dev-login formani ko'rsatadi —
  bu faqat development uchun
- `BOT_TOKEN` frontend'ga hech qachon tushmasligi kerak — faqat backend'da
