# 01 — Loyiha Overview

## Loyiha nomi
**Lesa Lego** — Qurilish jihozlarini ijaraga berish boshqaruv tizimi

## Muammo (Problem Statement)
Qurilish uchun lesa, apalofka, stoyka va boshqa jihozlarni ijaraga beradigan kichik biznes
hozirda qo'lda daftar yoki Excel bilan ishlaydi. Bu quyidagi muammolarga olib keladi:

- Kim qancha jihoz olganini eslab qolish qiyin
- Hisob-kitob xatolariga yo'l qo'yiladi (kunlar noto'g'ri hisoblanadi)
- Qarzlar nazorat qilinmaydi, mijoz to'lamasdan ketadi
- Nakladnoy va shartnoma qo'lda yoziladi — vaqt ketadi
- Xodim nima qilganini audit qilish imkoni yo'q
- Oylik daromad hisobotini chiqarish qiyin

## Yechim (Solution)
Telegram WebApp asosidagi to'liq avtomatlashtirilgan tizim:
- Arenda ochish, yopish, qisman qaytarish
- Avtomatik hisob-kitob (kunlar × narx × miqdor)
- Nakladnoy va shartnomani PDF formatda chiqarish
- Qarzdorlar nazorati va bot orqali eslatmalar
- Xodimlar auditi
- Oylik/kunlik hisobotlar

---

## Foydalanuvchilar (Actors)

### Admin
- Tizimning to'liq egasi
- Barcha ma'lumotlarni ko'radi, o'zgartiradi, o'chiradi
- Xodim qo'shadi va bloklaydi
- Hisobotlarni ko'radi
- Narxlarni, kategoriyalarni boshqaradi
- PDF shablonni sozlaydi (kompaniya nomi, logotip, INN)

### Worker (Xodim)
- Admin tomonidan qo'shiladi
- Yangi mijoz qo'sha oladi
- Yangi arenda ocha oladi
- To'lov kirita oladi
- Jihozlar qaytarishni qayd qila oladi
- O'z arendalari va mijozlarini ko'ra oladi
- **Qila olmaydi:** narx o'zgartirish, o'chirish, hisobotlar, boshqa workerlarni ko'rish

---

## Asosiy jarayonlar (Core Flows)

### 1. Yangi arenda jarayoni
```
Admin/Worker
  → Mijozni qidiradi yoki yangi qo'shadi
  → Jihozlarni tanlaydi (category → equipment → miqdor)
  → Boshlanish sanasini belgilaydi
  → Kutilgan tugash sanasini belgilaydi (ixtiyoriy)
  → Oldindan to'lov (depozit) kiritadi (ixtiyoriy)
  → Arenda ochiladi
  → Nakladnoy PDF avtomatik generatsiya qilinadi (2 nusxa)
  → Shartnoma PDF (ixtiyoriy)
  → Admin botga xabar keladi: "Yangi arenda ochildi"
```

### 2. Jihoz qaytarish jarayoni (qisman)
```
Admin/Worker
  → Faol arendani ochadi
  → "Qaytarish" tugmasini bosadi
  → Qaysi jihoz, nechta qaytarilayotganini kiritadi
  → Sana belgilanadi (default: bugun)
  → Tizim o'sha kundagi hisob-kitobni qayta hisoblaydi
  → Arenda qisman yopiladi (qolgan jihozlar hali faol)
  → Joriy check ko'rsatiladi
```

### 3. Arenda to'liq yopish jarayoni
```
Admin/Worker
  → Barcha jihozlar qaytarilgach
  → "Arenda yopish" tugmasi
  → Yakuniy hisob-kitob ko'rsatiladi
  → To'lov kiritiladi (agar qarz bo'lsa)
  → Yakuniy Check PDF generatsiya qilinadi (pechat + imzo joyi)
  → Arenda "completed" statusiga o'tadi
  → Equipment.availableQuantity yangilanadi
  → Admin botga xabar: "Arenda yopildi, jami: X so'm"
```

### 4. Nasiya/Qarz jarayoni
```
Mijoz to'liq to'lay olmasa:
  → Qarz miqdori kiritiladi
  → To'lov muddati belgilanadi
  → Qarzdorlar ro'yxatiga tushadi
  → Muddat 2 kun qolganda bot eslatma yuboradi (Admin ga)
  → Agar mijozning Telegram ID si bo'lsa — unga ham xabar
  → To'liq to'langanda qarz yopiladi
```

### 5. PDF Nakladnoy jarayoni
```
Arenda ochilganda avtomatik:
  → Kompaniya ma'lumotlari (Admin sozlagan shablon)
  → Mijoz ma'lumotlari
  → Jihozlar ro'yxati (nom, miqdor, kunlik narx)
  → Boshlanish sanasi, kutilgan tugash sanasi
  → 2 nusxa: "Beruvchi nusxasi" + "Oluvchi nusxasi"
  → Imzo va pechat joylari
  → Telegram orqali PDF yuboriladi yoki WebApp dan yuklab olinadi
```

---

## Tizim chegaralari (Scope)

### Kiradi (In scope)
- Telegram WebApp (asosiy interfeys)
- Telegram bot (faqat notification + /start)
- Admin + Worker rollar
- Category + Equipment boshqaruvi
- Mijoz bazasi
- Arenda boshqaruvi (qisman qaytarish bilan)
- To'lov qayd etish
- Nasiya/Qarz nazorati
- PDF: Nakladnoy, Shartnoma, Yakuniy Check
- Oylik/Kunlik hisobotlar
- Worker auditi
- Bot xabarnomalar (overdue, yangi arenda, to'lov)

### Kirmaydi (Out of scope)
- Onlayn to'lov integratsiyasi (Payme/Click) — keyingi versiya
- Mijoz o'zi ro'yxatdan o'tishi — yo'q
- Mobil ilovasi (iOS/Android) — yo'q
- Ko'p filial (multi-branch) — yo'q
- Ombor boshqarish (ta'mirlash, inventar) — soddalashtirilgan