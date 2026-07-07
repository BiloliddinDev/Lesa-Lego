# 05 — API Endpoints

## Umumiy qoidalar

### Base URL

```
Development:  http://localhost:5000/api
Production:   https://lesa-lego-backend.fly.dev/api
```

### Auth Header (barcha protected endpointlar)

```
Authorization: Bearer <jwt_token>
```

### Response format (muvaffaqiyatli)

```json
{
  "data": { ... } | [ ... ],
  "total": 24,        // list endpointlarda
  "page": 1,
  "totalPages": 2
}
```

### Error format (barcha xatolar)

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Foydalanuvchiga ko'rsatiladigan xabar",
    "fields": { "phone": ["Format noto'g'ri"] } // validation xatolarida
  }
}
```

### Error kodlar ro'yxati

```
AUTH_INVALID_INIT_DATA      401  Telegram initData noto'g'ri yoki eskirgan
AUTH_USER_NOT_FOUND         403  Tizimda ro'yxatdan o'tilmagan
AUTH_FORBIDDEN              403  Role ruxsat bermaydi
AUTH_TOKEN_EXPIRED          401  JWT muddati o'tgan
VALIDATION_ERROR            400  Zod schema xatosi
NOT_FOUND                   404  Resurs topilmadi
EQUIPMENT_NOT_AVAILABLE     400  Yetarli jihoz yo'q
RETURN_EXCEEDS_ACTIVE       400  Qaytarish miqdori active dan oshdi
RENTAL_ALREADY_CLOSED       400  Arenda allaqachon yopilgan
RENTAL_HAS_ACTIVE_ITEMS     400  Hali qaytarilmagan jihozlar bor
DUPLICATE_PHONE             409  Telefon raqam band
DUPLICATE_TELEGRAM_ID       409  Telegram ID band
CATEGORY_HAS_EQUIPMENT      400  Categoryni o'chirib bo'lmaydi (jihozlar bor)
EQUIPMENT_IN_ACTIVE_RENTAL  400  Jihozni o'chirib bo'lmaydi (arendada)
```

---

## 🔐 Auth

### POST /auth/telegram

WebApp ochilganda initData yuboriladi → JWT qaytadi.
**Auth:** yo'q

**Request:**

```json
{ "initData": "query_id=AAH...&user=%7B%22id%22:123..." }
```

**Response 200:**

```json
{
  "data": {
    "token": "eyJhbGci...",
    "user": {
      "_id": "64f...",
      "telegramId": 123456789,
      "fullName": "Alisher Karimov",
      "role": "admin",
      "isActive": true
    }
  }
}
```

**Response 401** — initData noto'g'ri yoki 24 soatdan eski  
**Response 403** — Foydalanuvchi DB da yo'q (admin qo'shmagan)

---

### GET /auth/me

Joriy foydalanuvchi ma'lumotlari.
**Auth:** required

**Response 200:**

```json
{
  "data": {
    "_id": "64f...",
    "telegramId": 123456789,
    "fullName": "Alisher Karimov",
    "role": "admin",
    "isActive": true,
    "createdAt": "2025-01-15T10:00:00Z"
  }
}
```

---

## 👥 Users

### GET /users

Barcha foydalanuvchilar.
**Auth:** Admin only

**Query params:**

```
?isActive=true|false
?role=ADMIN|WORKER
```

**Response 200:**

```json
{
  "data": [
    {
      "_id": "64f...",
      "telegramId": 987654321,
      "fullName": "Bobur Toshmatov",
      "username": "bobur_t",
      "role": "WORKER",
      "isActive": true,
      "createdAt": "2025-06-01T00:00:00Z"
    }
  ]
}
```

---

### POST /users

Yangi xodim qo'shish.
**Auth:** Admin only

**Request:**

```json
{
  "telegramId": 987654321,
  "fullName": "Bobur Toshmatov",
  "username": "bobur_t",
  "role": "WORKER"
}
```

**Response 201:** yaratilgan user  
**Response 409** — Bu telegramId allaqachon bor

---

### GET /users/:id

Bitta xodim + uning audit logi.
**Auth:** Admin only

**Response 200:**

```json
{
  "data": {
    "_id": "64f...",
    "fullName": "Bobur Toshmatov",
    "role": "WORKER",
    "isActive": true,
    "stats": {
      "totalRentalsCreated": 12,
      "totalPaymentsAdded": 8,
      "lastActivity": "2025-06-28T14:30:00Z"
    }
  }
}
```

---

### PATCH /users/:id

Xodim ma'lumotlarini yangilash.
**Auth:** Admin only

**Request:**

```json
{ "isActive": false }
```

**Response 200:** yangilangan user

---

### GET /users/:id/audit

Xodimning barcha amallarini ko'rish.
**Auth:** Admin only

**Query params:**

```
?action=rental.create|payment.create|...
?from=2025-06-01&to=2025-06-30
?page=1&limit=20
```

**Response 200:**

```json
{
  "data": [
    {
      "action": "rental.create",
      "resourceType": "rental",
      "resourceName": "ARN-2025-0012",
      "createdAt": "2025-06-28T09:15:00Z"
    }
  ],
  "total": 45
}
```

---

## 📂 Categories

### GET /categories

Barcha kategoriyalar (ichida equipment soni bilan).
**Auth:** Admin | Worker

**Response 200:**

```json
{
  "data": [
    {
      "_id": "64f...",
      "name": "Lesa",
      "description": "Qurilish lesalari",
      "order": 1,
      "isActive": true,
      "equipmentCount": 3,
      "totalQuantity": 50,
      "availableQuantity": 32
    }
  ]
}
```

---

### POST /categories

Yangi kategoriya.
**Auth:** Admin only

**Request:**

```json
{
  "name": "Lesa",
  "description": "Qurilish lesalari",
  "order": 1
}
```

**Response 201:** yaratilgan category  
**Response 409** — Bu nom allaqachon bor

---

### PATCH /categories/:id

Kategoriyani yangilash.
**Auth:** Admin only

**Request:**

```json
{ "name": "Lesa (yangilangan)", "order": 2 }
```

**Response 200:** yangilangan category

---

### DELETE /categories/:id

Kategoriyani o'chirish (soft delete — isActive: false).
**Auth:** Admin only

**Response 400** — Ichida faol jihozlar bo'lsa o'chirib bo'lmaydi

---

## 📦 Equipment

### GET /equipment

Barcha jihozlar.
**Auth:** Admin | Worker

**Query params:**

```
?categoryId=64f...
?isActive=true|false
?available=true          availableQuantity > 0
?search=lesa
```

**Response 200:**

```json
{
  "data": [
    {
      "_id": "64f...",
      "category": { "_id": "64f...", "name": "Lesa" },
      "name": "Lesa A-seriya 2m",
      "description": "Alyuminiy, 2m balandlik",
      "totalQuantity": 10,
      "rentedQuantity": 4,
      "availableQuantity": 6,
      "dailyRate": 5000,
      "isActive": true
    }
  ]
}
```

---

### POST /equipment

Yangi jihoz qo'shish.
**Auth:** Admin only

**Request:**

```json
{
  "categoryId": "64f...",
  "name": "Lesa A-seriya 2m",
  "description": "Alyuminiy, 2m balandlik",
  "totalQuantity": 10,
  "dailyRate": 5000
}
```

**Response 201:** yaratilgan equipment

---

### GET /equipment/:id

Bitta jihoz (arenda tarixi bilan).
**Auth:** Admin | Worker

**Response 200:**

```json
{
  "data": {
    "_id": "64f...",
    "name": "Lesa A-seriya 2m",
    "totalQuantity": 10,
    "rentedQuantity": 4,
    "availableQuantity": 6,
    "dailyRate": 5000,
    "activeRentals": [
      {
        "rentalNumber": "ARN-2025-0005",
        "client": "Alisher Karimov",
        "quantity": 4,
        "startDate": "2025-06-20"
      }
    ]
  }
}
```

---

### PATCH /equipment/:id

Jihoz ma'lumotlarini yangilash.
**Auth:** Admin only

**Request:**

```json
{ "dailyRate": 6000, "description": "Yangi narx 2025" }
```

> Narx o'zgartirish audit logga yoziladi (before/after)

**Response 200:** yangilangan equipment

---

### PATCH /equipment/:id/quantity

Ombor miqdorini sozlash.
**Auth:** Admin only

**Request:**

```json
{
  "adjustment": 5,
  "reason": "Yangi lesa xarid qilindi"
}
```

**Response 200:**

```json
{
  "data": {
    "totalQuantity": 15,
    "rentedQuantity": 4,
    "availableQuantity": 11,
    "adjustment": 5,
    "reason": "Yangi lesa xarid qilindi"
  }
}
```

**Response 400** — adjustment natijasida totalQuantity < rentedQuantity bo'lsa

---

### DELETE /equipment/:id

Jihozni o'chirish (soft delete).
**Auth:** Admin only

**Response 400** — Faol arendalarda ishlatilayotgan bo'lsa

---

## 👤 Clients

### GET /clients

Barcha mijozlar.
**Auth:** Admin | Worker

**Query params:**

```
?search=Alisher           fullName yoki phone bo'yicha
?hasDebt=true             totalDebt > 0
?isActive=true|false
?page=1&limit=20
```

**Response 200:**

```json
{
  "data": [
    {
      "_id": "64f...",
      "fullName": "Vohid Rahimov",
      "phone": "+998977654321",
      "address": "Chilonzor, 12-uy",
      "totalDebt": 250000,
      "isActive": true,
      "activeRentalsCount": 1,
      "totalRentalsCount": 5
    }
  ],
  "total": 24,
  "page": 1,
  "totalPages": 2
}
```

---

### POST /clients

Yangi mijoz qo'shish.
**Auth:** Admin | Worker

**Request:**

```json
{
  "fullName": "Vohid Rahimov",
  "phone": "+998977654321",
  "address": "Chilonzor, 12-uy",
  "note": "Ishonchli mijoz",
  "telegramId": 111222333
}
```

**Response 201:** yaratilgan client  
**Response 409** — Bu telefon raqam allaqachon mavjud

---

### GET /clients/:id

Bitta mijoz (to'liq ma'lumot).
**Auth:** Admin | Worker

**Response 200:**

```json
{
  "data": {
    "_id": "64f...",
    "fullName": "Vohid Rahimov",
    "phone": "+998977654321",
    "address": "Chilonzor, 12-uy",
    "note": "Ishonchli mijoz",
    "telegramId": 111222333,
    "totalDebt": 250000,
    "isActive": true,
    "stats": {
      "totalRentals": 5,
      "activeRentals": 1,
      "completedRentals": 4,
      "totalPaid": 3200000,
      "totalDebt": 250000,
      "lastRentalDate": "2025-06-15"
    },
    "createdAt": "2025-01-10T00:00:00Z"
  }
}
```

---

### GET /clients/:id/rentals

Mijozning barcha arendalari.
**Auth:** Admin | Worker

**Query params:**

```
?status=active|completed|overdue
?page=1&limit=20
```

**Response 200:**

```json
{
  "data": [
    {
      "_id": "64f...",
      "rentalNumber": "ARN-2025-0005",
      "status": "active",
      "startDate": "2025-06-15",
      "expectedEndDate": "2025-07-01",
      "totalAmount": 800000,
      "paidAmount": 550000,
      "debt": 250000,
      "items": [
        {
          "equipmentName": "Lesa A-seriya 2m",
          "quantity": 8,
          "returnedQuantity": 0
        }
      ]
    }
  ],
  "total": 5
}
```

---

### PATCH /clients/:id

Mijozni yangilash.
**Auth:** Admin only

**Request:**

```json
{
  "phone": "+998901111111",
  "note": "Yangilangan eslatma"
}
```

**Response 200:** yangilangan client

---

## 📋 Rentals

### GET /rentals

Barcha arendalar.
**Auth:** Admin (hammasi) | Worker (faqat o'ziniki)

**Query params:**

```
?status=active|overdue|completed
?clientId=64f...
?createdBy=64f...         Worker o'z arendalari uchun
?from=2025-06-01
?to=2025-06-30
?page=1&limit=20
```

**Response 200:**

```json
{
  "data": [
    {
      "_id": "64f...",
      "rentalNumber": "ARN-2025-0005",
      "client": {
        "_id": "64f...",
        "fullName": "Vohid Rahimov",
        "phone": "+998977654321"
      },
      "status": "active",
      "startDate": "2025-06-15T00:00:00Z",
      "expectedEndDate": "2025-07-01T00:00:00Z",
      "endDate": null,
      "depositAmount": 100000,
      "paidAmount": 550000,
      "currentAmount": 800000,
      "debt": 150000,
      "items": [
        {
          "equipmentName": "Lesa A-seriya 2m",
          "equipmentCategory": "Lesa",
          "quantity": 8,
          "returnedQuantity": 0,
          "dailyRate": 5000
        }
      ],
      "createdBy": { "fullName": "Bobur Toshmatov" },
      "createdAt": "2025-06-15T08:30:00Z"
    }
  ],
  "total": 12,
  "page": 1,
  "totalPages": 1
}
```

---

### POST /rentals

Yangi arenda ochish.
**Auth:** Admin | Worker

**Request:**

```json
{
  "clientId": "64f...",
  "items": [
    {
      "equipmentId": "64f...",
      "quantity": 8
    },
    {
      "equipmentId": "64f...",
      "quantity": 4,
      "dailyRate": 3000
    }
  ],
  "startDate": "2025-06-29T00:00:00Z",
  "expectedEndDate": "2025-07-15T00:00:00Z",
  "depositAmount": 100000,
  "note": "Chilonzor 5-uy qurilishi"
}
```

**Response 201:**

```json
{
  "data": {
    "_id": "64f...",
    "rentalNumber": "ARN-2025-0013",
    "status": "active",
    ...
  }
}
```

> Avtomatik: Equipment.rentedQuantity oshiriladi, AuditLog yoziladi, Admin ga bot xabari ketadi

**Response 400** — equipment yetarli emas  
**Response 404** — client yoki equipment topilmasa

---

### GET /rentals/:id

Bitta arenda to'liq ma'lumoti.
**Auth:** Admin | Worker (faqat o'zinikilari)

**Response 200:** to'liq rental object (yuqoridagidek)

---

### GET /rentals/:id/check

Joriy hisob (arenda ochiq).
**Auth:** Admin | Worker

**Response 200:**

```json
{
  "data": {
    "rentalNumber": "ARN-2025-0005",
    "client": {
      "fullName": "Vohid Rahimov",
      "phone": "+998977654321"
    },
    "startDate": "2025-06-15",
    "checkDate": "2025-06-29",
    "status": "active",
    "items": [
      {
        "equipmentName": "Lesa A-seriya 2m",
        "quantity": 8,
        "returnedQuantity": 3,
        "activeQuantity": 5,
        "dailyRate": 5000,
        "segments": [
          {
            "from": "2025-06-15",
            "to": "2025-06-22",
            "quantity": 8,
            "days": 7,
            "amount": 280000
          },
          {
            "from": "2025-06-22",
            "to": "2025-06-29",
            "quantity": 5,
            "days": 7,
            "amount": 175000
          }
        ],
        "itemTotal": 455000
      }
    ],
    "totalAmount": 455000,
    "depositAmount": 100000,
    "paidAmount": 200000,
    "debt": 155000,
    "overpaid": 0
  }
}
```

---

### POST /rentals/:id/return

Jihozlarni (qisman) qaytarish.
**Auth:** Admin | Worker

**Request:**

```json
{
  "returns": [
    {
      "equipmentId": "64f...",
      "quantity": 3,
      "note": "Bino 1-qavati tayyor"
    }
  ],
  "returnDate": "2025-06-22T00:00:00Z"
}
```

**Response 200:**

```json
{
  "data": {
    "rental": { ...updated rental },
    "check": { ...joriy hisob }
  }
}
```

> Avtomatik: Equipment.rentedQuantity kamayadi, AuditLog yoziladi

**Response 400** — quantity > activeQuantity  
**Response 400** — Arenda yopilgan

---

### POST /rentals/:id/close

Arenda to'liq yopish.
**Auth:** Admin | Worker

**Request:**

```json
{
  "endDate": "2025-06-29T00:00:00Z",
  "note": "Hamma narsa tartibda"
}
```

**Response 200:**

```json
{
  "data": {
    "rental": { ...rental, status: "completed" },
    "finalCheck": { ...yakuniy hisob }
  }
}
```

> Avtomatik: status=completed, Equipment.rentedQuantity=0, Client.totalDebt yangilanadi, AuditLog, Admin botga xabar

**Response 400** — Hali qaytarilmagan jihozlar bor (avval /return chaqiring)

---

### PATCH /rentals/:id

Arenda meta-ma'lumotlarini tahrirlash.
**Auth:** Admin only

**Request:**

```json
{
  "expectedEndDate": "2025-07-20T00:00:00Z",
  "note": "Muddat uzaytirildi, kelishildi"
}
```

**Response 200:** yangilangan rental

---

### GET /rentals/:id/pdf

PDF yuklab olish.
**Auth:** Admin | Worker

**Query params:**

```
?type=nakladnoy|check|contract
```

**Response 200:**

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="ARN-2025-0005-nakladnoy.pdf"
[binary PDF data]
```

---

## 💰 Payments

### GET /payments

To'lovlar ro'yxati.
**Auth:** Admin | Worker

**Query params:**

```
?rentalId=64f...
?clientId=64f...
?method=cash|card|transfer
?from=2025-06-01&to=2025-06-30
?page=1&limit=20
```

**Response 200:**

```json
{
  "data": [
    {
      "_id": "64f...",
      "rental": {
        "_id": "64f...",
        "rentalNumber": "ARN-2025-0005"
      },
      "client": {
        "_id": "64f...",
        "fullName": "Vohid Rahimov"
      },
      "amount": 300000,
      "method": "cash",
      "note": "Naqd to'lov",
      "createdBy": { "fullName": "Bobur Toshmatov" },
      "createdAt": "2025-06-20T14:00:00Z"
    }
  ],
  "total": 8
}
```

---

### POST /payments

Yangi to'lov kiritish.
**Auth:** Admin | Worker

**Request:**

```json
{
  "rentalId": "64f...",
  "amount": 300000,
  "method": "cash",
  "note": "Naqd to'lov"
}
```

**Response 201:**

```json
{
  "data": {
    "_id": "64f...",
    "amount": 300000,
    "method": "cash",
    "rental": { "rentalNumber": "ARN-2025-0005" },
    "createdAt": "2025-06-29T10:00:00Z"
  }
}
```

> Avtomatik: Rental.paidAmount yangilanadi, Client.totalDebt yangilanadi, AuditLog, Admin botga xabar

**Response 404** — rental topilmasa

---

### DELETE /payments/:id

To'lovni bekor qilish.
**Auth:** Admin only

**Response 200:**

```json
{ "data": { "message": "To'lov bekor qilindi" } }
```

> Avtomatik: Rental.paidAmount qayta hisoblanadi, Client.totalDebt yangilanadi, AuditLog

---

## 💸 Debts

### GET /debts

Qarzdorlar ro'yxati.
**Auth:** Admin | Worker

**Query params:**

```
?status=pending|paid|overdue
?clientId=64f...
?page=1&limit=20
```

**Response 200:**

```json
{
  "data": [
    {
      "_id": "64f...",
      "client": {
        "_id": "64f...",
        "fullName": "Sardor Yusupov",
        "phone": "+998901111222"
      },
      "rental": { "rentalNumber": "ARN-2025-0003" },
      "amount": 450000,
      "dueDate": "2025-07-10",
      "status": "pending",
      "overdueDays": 0,
      "createdAt": "2025-06-29T00:00:00Z"
    }
  ],
  "total": 5
}
```

---

### POST /debts

Yangi nasiya qayd etish (arenda yopilganda qarz bo'lsa).
**Auth:** Admin | Worker

**Request:**

```json
{
  "clientId": "64f...",
  "rentalId": "64f...",
  "amount": 450000,
  "dueDate": "2025-07-10T00:00:00Z",
  "note": "2 haftaga kelishildi"
}
```

**Response 201:** yaratilgan debt

---

### POST /debts/:id/pay

Qarzni to'lash.
**Auth:** Admin | Worker

**Request:**

```json
{
  "amount": 450000,
  "method": "cash",
  "note": "To'liq to'landi"
}
```

**Response 200:**

```json
{
  "data": {
    "debt": { ...debt, status: "paid", paidDate: "2025-07-05" },
    "payment": { ...yaratilgan payment }
  }
}
```

---

## 📊 Reports

### GET /reports/summary

Bosh sahifa dashboard uchun umumiy statistika.
**Auth:** Admin only

**Response 200:**

```json
{
  "data": {
    "today": "2025-06-29",
    "activeRentals": 7,
    "overdueRentals": 2,
    "totalDebtors": 5,
    "totalDebt": 3250000,
    "equipmentStats": {
      "totalOut": 42,
      "totalAvailable": 28
    },
    "todayStats": {
      "newRentals": 2,
      "closedRentals": 1,
      "paymentsReceived": 850000,
      "newClients": 1
    }
  }
}
```

---

### GET /reports/monthly

Oylik hisobot.
**Auth:** Admin only

**Query params:**

```
?year=2025&month=6
```

**Response 200:**

```json
{
  "data": {
    "period": "2025-06",
    "revenue": 12500000,
    "newRentals": 18,
    "closedRentals": 15,
    "newClients": 6,
    "paymentsReceived": 11800000,
    "topClients": [
      { "fullName": "Vohid Rahimov", "totalPaid": 1500000 }
    ],
    "topEquipment": [
      { "name": "Lesa A-seriya 2m", "rentalCount": 8 }
    ],
    "dailyRevenue": [
      { "date": "2025-06-01", "amount": 450000 },
      ...
    ]
  }
}
```

---

### GET /reports/overdue

Muddati o'tgan arendalar.
**Auth:** Admin | Worker

**Response 200:**

```json
{
  "data": [
    {
      "rentalNumber": "ARN-2025-0003",
      "client": {
        "fullName": "Sardor Yusupov",
        "phone": "+998901111222",
        "telegramId": 444555666
      },
      "expectedEndDate": "2025-06-20",
      "overdueDays": 9,
      "currentDebt": 850000,
      "items": [{ "equipmentName": "Lesa B-seriya", "activeQuantity": 5 }]
    }
  ]
}
```

---

## ⚙️ Settings

### GET /settings

Kompaniya sozlamalarini olish.
**Auth:** Admin only

**Response 200:**

```json
{
  "data": {
    "companyName": "Lesa Lego MChJ",
    "ownerName": "Karimov Alisher",
    "address": "Toshkent sh, Chilonzor t, 5-uy",
    "phone": "+998 90 123 45 67",
    "inn": "123456789",
    "bankAccount": "2020 8000 1234 5678",
    "bankName": "Xalq banki",
    "hasLogo": true,
    "hasStamp": true,
    "hasSignature": false,
    "contractTemplate": "Mazkur shartnoma ...",
    "rentalTerms": "1. Jihozlar belgilangan muddatda qaytarilishi shart..."
  }
}
```

---

### PATCH /settings

Kompaniya sozlamalarini yangilash.
**Auth:** Admin only

**Request:**

```json
{
  "companyName": "Lesa Lego MChJ",
  "ownerName": "Karimov Alisher",
  "phone": "+998901234567",
  "inn": "123456789"
}
```

**Response 200:** yangilangan settings

---

### POST /settings/logo

Logo yuklash.
**Auth:** Admin only

**Request:** multipart/form-data, field: `logo` (image/png, image/jpeg, max 2MB)

**Response 200:**

```json
{ "data": { "message": "Logo saqlandi" } }
```

---

### POST /settings/stamp

Pechat rasmi yuklash.
**Auth:** Admin only

**Request:** multipart/form-data, field: `stamp` (image/png, max 2MB)

---

### POST /settings/signature

Imzo rasmi yuklash.
**Auth:** Admin only

**Request:** multipart/form-data, field: `signature` (image/png, max 2MB)

---

## 🏥 Health

### GET /health

Server holati tekshirish (deploy monitoring uchun).
**Auth:** yo'q

**Response 200:**

```json
{
  "status": "ok",
  "db": "connected",
  "uptime": 3600,
  "timestamp": "2025-06-29T10:00:00Z"
}
```
