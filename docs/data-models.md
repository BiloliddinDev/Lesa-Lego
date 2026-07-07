# 04 — Data Models

## Umumiy qoidalar
- Barcha `_id` lar MongoDB ObjectId
- `createdAt` / `updatedAt` — Mongoose `timestamps: true` bilan avtomatik
- Pul miqdorlari **butun son (so'm)** saqlanadi — float xatolari bo'lmasin
- Sana/vaqt — UTC da saqlanadi, frontendda O'zbek vaqtiga (+5) o'giriladi

---

## 1. User

### Mongoose Schema
```typescript
const UserSchema = new Schema({
  telegramId:  { type: Number, required: true, unique: true },
  fullName:    { type: String, required: true, trim: true },
  username:    { type: String, trim: true },
  role:        { type: String, enum: ['admin', 'worker'], required: true },
  isActive:    { type: Boolean, default: true },
}, { timestamps: true })

UserSchema.index({ telegramId: 1 }, { unique: true })
```

### DTO (Zod)
```typescript
export const createUserSchema = z.object({
  telegramId: z.number().int().positive(),
  fullName:   z.string().min(2).max(100).trim(),
  username:   z.string().optional(),
  role:       z.literal('worker'),
})

export const updateUserSchema = z.object({
  fullName:  z.string().min(2).max(100).trim().optional(),
  isActive:  z.boolean().optional(),
})
```

---

## 2. Category

### Mongoose Schema
```typescript
const CategorySchema = new Schema({
  name:        { type: String, required: true, unique: true, trim: true },
  description: { type: String },
  isActive:    { type: Boolean, default: true },
  order:       { type: Number, default: 0 },
}, { timestamps: true })
```

### DTO
```typescript
export const createCategorySchema = z.object({
  name:        z.string().min(2).max(50).trim(),
  description: z.string().max(200).optional(),
  order:       z.number().int().min(0).optional(),
})

export const updateCategorySchema = createCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
})
```

---

## 3. Equipment (Jihoz)

### Mongoose Schema
```typescript
const EquipmentSchema = new Schema({
  category:       { type: Schema.Types.ObjectId, ref: 'Category', required: true },
  name:           { type: String, required: true, trim: true },
  description:    { type: String },
  totalQuantity:  { type: Number, required: true, min: 0 },
  rentedQuantity: { type: Number, default: 0, min: 0 },
  dailyRate:      { type: Number, required: true, min: 0 },
  isActive:       { type: Boolean, default: true },
}, { timestamps: true })

// availableQuantity = totalQuantity - rentedQuantity (virtual)
EquipmentSchema.virtual('availableQuantity').get(function () {
  return this.totalQuantity - this.rentedQuantity
})

EquipmentSchema.index({ category: 1 })
EquipmentSchema.index({ isActive: 1 })
```

### DTO
```typescript
export const createEquipmentSchema = z.object({
  categoryId:    z.string().length(24),
  name:          z.string().min(2).max(100).trim(),
  description:   z.string().max(300).optional(),
  totalQuantity: z.number().int().min(1),
  dailyRate:     z.number().int().min(0),
})

export const updateEquipmentSchema = z.object({
  name:        z.string().min(2).max(100).trim().optional(),
  description: z.string().max(300).optional(),
  dailyRate:   z.number().int().min(0).optional(),
  isActive:    z.boolean().optional(),
})

export const adjustQuantitySchema = z.object({
  adjustment: z.number().int().refine(n => n !== 0, 'Nol bolmasin'),
  reason: z.string().min(3).max(200),
})
```

---

## 4. Client (Mijoz)

### Mongoose Schema
```typescript
const ClientSchema = new Schema({
  fullName:   { type: String, required: true, trim: true },
  phone:      { type: String, required: true, unique: true },
  telegramId: { type: Number, sparse: true },
  address:    { type: String },
  note:       { type: String },
  totalDebt:  { type: Number, default: 0 },
  isActive:   { type: Boolean, default: true },
  createdBy:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

ClientSchema.index({ phone: 1 }, { unique: true })
ClientSchema.index({ telegramId: 1 }, { sparse: true, unique: true })
ClientSchema.index({ fullName: 'text' })
```

### DTO
```typescript
export const createClientSchema = z.object({
  fullName:   z.string().min(2).max(100).trim(),
  phone:      z.string().regex(/^\+998\d{9}$/, 'Format: +998901234567'),
  telegramId: z.number().int().positive().optional(),
  address:    z.string().max(200).optional(),
  note:       z.string().max(500).optional(),
})

export const updateClientSchema = z.object({
  fullName:   z.string().min(2).max(100).trim().optional(),
  phone:      z.string().regex(/^\+998\d{9}$/).optional(),
  telegramId: z.number().int().positive().nullable().optional(),
  address:    z.string().max(200).optional(),
  note:       z.string().max(500).optional(),
})

export const clientSearchSchema = z.object({
  search:   z.string().optional(),
  hasDebt:  z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional(),
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(100).default(20),
})
```

---

## 5. Rental (Arenda)

### Embedded types
```typescript
interface IReturnEvent {
  date:     Date
  quantity: number
  note?:    string
  doneBy:   ObjectId
}

interface IRentalItem {
  equipment:         ObjectId
  equipmentName:     string      // snapshot
  equipmentCategory: string      // snapshot
  quantity:          number
  dailyRate:         number      // snapshot (o'sha kundagi narx)
  returnedQuantity:  number
  returns:           IReturnEvent[]
}
```

### Mongoose Schema
```typescript
const RentalSchema = new Schema({
  rentalNumber:    { type: String, unique: true },

  client:    { type: Schema.Types.ObjectId, ref: 'Client', required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },

  items: [{
    equipment:         { type: Schema.Types.ObjectId, ref: 'Equipment' },
    equipmentName:     String,
    equipmentCategory: String,
    quantity:          { type: Number, required: true, min: 1 },
    dailyRate:         { type: Number, required: true, min: 0 },
    returnedQuantity:  { type: Number, default: 0 },
    returns: [{
      date:     { type: Date, required: true },
      quantity: { type: Number, required: true, min: 1 },
      note:     String,
      doneBy:   { type: Schema.Types.ObjectId, ref: 'User' }
    }]
  }],

  startDate:       { type: Date, required: true },
  expectedEndDate: { type: Date },
  endDate:         { type: Date },

  status: {
    type: String,
    enum: ['active', 'overdue', 'completed'],
    default: 'active'
  },

  depositAmount: { type: Number, default: 0 },
  paidAmount:    { type: Number, default: 0 },
  // totalAmount va debt HISOBLANADI, saqlanmaydi

  note: String,
}, { timestamps: true })

// Pre-save: rentalNumber generatsiya
RentalSchema.pre('save', async function (next) {
  if (!this.rentalNumber) {
    const year = new Date().getFullYear()
    const count = await Rental.countDocuments({
      rentalNumber: new RegExp(`^ARN-${year}-`)
    })
    this.rentalNumber = `ARN-${year}-${String(count + 1).padStart(4, '0')}`
  }
  next()
})

RentalSchema.index({ rentalNumber: 1 }, { unique: true })
RentalSchema.index({ client: 1 })
RentalSchema.index({ status: 1 })
RentalSchema.index({ startDate: -1 })
RentalSchema.index({ createdBy: 1 })
RentalSchema.index({ expectedEndDate: 1, status: 1 })
```

### DTO
```typescript
export const createRentalSchema = z.object({
  clientId: z.string().length(24),
  items: z.array(z.object({
    equipmentId: z.string().length(24),
    quantity:    z.number().int().min(1),
    dailyRate:   z.number().int().min(0).optional(),
  })).min(1, 'Kamida 1 ta jihoz'),
  startDate:       z.string().datetime(),
  expectedEndDate: z.string().datetime().optional(),
  depositAmount:   z.number().int().min(0).default(0),
  note:            z.string().max(500).optional(),
})

export const returnItemsSchema = z.object({
  returns: z.array(z.object({
    equipmentId: z.string().length(24),
    quantity:    z.number().int().min(1),
    note:        z.string().max(200).optional(),
  })).min(1),
  returnDate: z.string().datetime().optional(),
})

export const closeRentalSchema = z.object({
  endDate: z.string().datetime().optional(),
  note:    z.string().max(500).optional(),
})

export const rentalFilterSchema = z.object({
  status:   z.enum(['active', 'overdue', 'completed']).optional(),
  clientId: z.string().length(24).optional(),
  from:     z.string().datetime().optional(),
  to:       z.string().datetime().optional(),
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(50).default(20),
})
```

---

## 6. Payment (Tolов)

### Mongoose Schema
```typescript
const PaymentSchema = new Schema({
  rental:    { type: Schema.Types.ObjectId, ref: 'Rental', required: true },
  client:    { type: Schema.Types.ObjectId, ref: 'Client', required: true },
  amount:    { type: Number, required: true, min: 1 },
  method:    { type: String, enum: ['cash', 'card', 'transfer'], required: true },
  note:      String,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

PaymentSchema.index({ rental: 1 })
PaymentSchema.index({ client: 1 })
PaymentSchema.index({ createdAt: -1 })
```

### DTO
```typescript
export const createPaymentSchema = z.object({
  rentalId: z.string().length(24),
  amount:   z.number().int().min(1),
  method:   z.enum(['cash', 'card', 'transfer']),
  note:     z.string().max(200).optional(),
})
```

---

## 7. Debt (Nasiya)

```typescript
const DebtSchema = new Schema({
  client:   { type: Schema.Types.ObjectId, ref: 'Client', required: true },
  rental:   { type: Schema.Types.ObjectId, ref: 'Rental', required: true },
  amount:   { type: Number, required: true, min: 1 },
  dueDate:  { type: Date },
  paidDate: { type: Date },
  status:   { type: String, enum: ['pending', 'paid', 'overdue'], default: 'pending' },
  note:     String,
}, { timestamps: true })

DebtSchema.index({ client: 1 })
DebtSchema.index({ status: 1 })
DebtSchema.index({ dueDate: 1, status: 1 })
```

### DTO
```typescript
export const createDebtSchema = z.object({
  clientId: z.string().length(24),
  rentalId: z.string().length(24),
  amount:   z.number().int().min(1),
  dueDate:  z.string().datetime().optional(),
  note:     z.string().max(300).optional(),
})
```

---

## 8. AuditLog

```typescript
const AuditLogSchema = new Schema({
  userId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
  userFullName: String,
  userRole:     String,
  action:       { type: String, required: true },
  resourceType: String,
  resourceId:   Schema.Types.ObjectId,
  resourceName: String,
  before:       Schema.Types.Mixed,
  after:        Schema.Types.Mixed,
}, { timestamps: true })

// Action turlari:
// rental.create | rental.close | rental.return_items
// payment.create | payment.delete
// client.create | client.update
// equipment.create | equipment.price_change | equipment.quantity_adjust
// user.create | user.block | user.unblock
// debt.create | debt.paid

AuditLogSchema.index({ userId: 1 })
AuditLogSchema.index({ action: 1 })
AuditLogSchema.index({ resourceType: 1, resourceId: 1 })
AuditLogSchema.index({ createdAt: -1 })
```

---

## 9. CompanySettings (Singleton)

```typescript
const CompanySettingsSchema = new Schema({
  companyName:      { type: String, default: '' },
  ownerName:        { type: String, default: '' },
  address:          { type: String, default: '' },
  phone:            { type: String, default: '' },
  inn:              { type: String, default: '' },
  bankAccount:      { type: String, default: '' },
  bankName:         { type: String, default: '' },
  logoBase64:       { type: String, default: '' },
  stampBase64:      { type: String, default: '' },
  signatureBase64:  { type: String, default: '' },
  contractTemplate: { type: String, default: '' },
  rentalTerms:      { type: String, default: '' },
}, { timestamps: true })
```

---

## Hisob-kitob logikasi

### Segment-based hisoblash

```
Misol: 10 ta lesa, 5000 so'm/kun
  01-iyul: Berildi (10 ta)
  10-iyul: 5 ta qaytarildi
  20-iyul: 5 ta qaytarildi → Yopildi

  Segment 1: 10 ta × 5000 × 9 kun  = 450,000 so'm
  Segment 2:  5 ta × 5000 × 10 kun = 250,000 so'm
  JAMI:                               700,000 so'm
```

```typescript
function calculateItemAmount(item: IRentalItem, endDate: Date): number {
  let total = 0
  let prevDate = rentalStartDate
  let activeQty = item.quantity

  const sorted = [...item.returns].sort((a, b) =>
    a.date.getTime() - b.date.getTime()
  )

  for (const ret of sorted) {
    const days = Math.ceil((ret.date.getTime() - prevDate.getTime()) / 86400000)
    total += activeQty * item.dailyRate * days
    activeQty -= ret.quantity
    prevDate = ret.date
  }

  if (activeQty > 0) {
    const days = Math.ceil((endDate.getTime() - prevDate.getTime()) / 86400000)
    total += activeQty * item.dailyRate * days
  }

  return total
}
```

### Joriy check formula
```
totalAmount = Σ calculateItemAmount(item, TODAY) for all items
debt        = totalAmount - depositAmount - paidAmount
overpaid    = debt < 0 ? abs(debt) : 0
```

### Client.totalDebt hisoblash
```
totalDebt = Σ max(0, rental.totalAmount - rental.paidAmount - rental.depositAmount)
            WHERE rental.status IN ['active', 'overdue']
          + Σ debt.amount WHERE debt.status = 'pending'
```