# 10 — Nasiya & Qarz (Debt)

> ⚠️ **AMALDAGI MODEL (17.09.2026 dan)** — quyidagi kod namunalari dastlabki
> loyihadan; ular `Client.totalDebt` ni `$inc` bilan o'zgartiradi. Kodda
> BUNDAY QILINMAYDI, chunki ikkita bir-biriga qarama-qarshi manba paydo
> bo'lardi. Haqiqiy qoidalar:
>
> 1. **Pulning yagona manbasi — arenda hisobi** (`services/rental-calc.ts`).
>    `Client.totalDebt` mijozning BARCHA arendalari (yopilganlari ham)
>    bo'yicha `calculateRental().debt` yig'indisi sifatida qayta hisoblanadi
>    (`services/client-debt.service.ts`).
> 2. **`Debt` hujjati — faqat muddat va eslatma qatlami** (`dueDate`,
>    `status`). Uning summasi `totalDebt` ga QO'SHILMAYDI — aks holda bir xil
>    pul ikki marta sanaladi.
> 3. `Debt` arenda yopilganda qarz qolsa avtomatik ochiladi
>    (`rental.service.ts` → `closeRental`).
> 4. To'lovdan keyin hujjat holati arenda hisobiga moslanadi
>    (`services/debt-status.service.ts`): qarz 0 bo'lsa `paid`, to'lov bekor
>    qilinsa `pending` ga qaytadi.
> 5. Muddat nazorati — `jobs/overdue-check.ts` ichida, har kuni 09:00 (APP_TZ):
>    `dueDate - 2 kun` da eslatma, muddat o'tganda `overdue` + xabar.

## Umumiy tushuncha

Nasiya — mijoz arenda tugaganda to'liq to'lay olmagan holat.
Ikki xil qarz mavjud:

```
1. Faol arenda qarzi   → rental.debt (hisob-kitob orqali, real-time)
2. Yopilgan arenda qarzi → Debt model (arenda yopilganda qarz qolsa)
```

Debt model faqat arenda **yopilgandan keyin** yaratiladi.
Faol arenda da qarz — CheckService dan olinadi.

---

## DebtService

```typescript
// src/services/DebtService.ts

export class DebtService {
  // Barcha qarzdorlar
  static async getAll(filters: DebtFilters) {
    const query: any = {};
    if (filters.status) query.status = filters.status;
    if (filters.clientId) query.client = filters.clientId;

    const total = await Debt.countDocuments(query);
    const debts = await Debt.find(query)
      .populate("client", "fullName phone telegramId")
      .populate("rental", "rentalNumber startDate endDate")
      .sort({ dueDate: 1, createdAt: -1 })
      .skip((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .lean();

    // overdue statusni real-time hisoblash
    const today = new Date();
    const result = debts.map((d) => ({
      ...d,
      overdueDays:
        d.status === "pending" && d.dueDate && d.dueDate < today
          ? Math.ceil((today.getTime() - d.dueDate.getTime()) / 86400000)
          : 0,
    }));

    return {
      data: result,
      total,
      page: filters.page,
      totalPages: Math.ceil(total / filters.limit),
    };
  }

  // Arenda yopilganda qarz qolsa — avtomatik yaratiladi
  static async createFromRental(
    rental: IRental,
    check: CheckResult,
    dto: { dueDate?: string; note?: string },
    userId: string,
  ) {
    if (check.debt <= 0) return null;

    const debt = await Debt.create({
      client: rental.client,
      rental: rental._id,
      amount: check.debt,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      status: "pending",
      note: dto.note,
    });

    // Client.totalDebt yangilash
    await ClientService.recalculateDebt(rental.client.toString());

    await audit({
      userId,
      action: "debt.create",
      resourceType: "debt",
      resourceId: debt._id,
      resourceName: `${check.rentalNumber} — ${formatMoney(check.debt)}`,
      after: { amount: check.debt, dueDate: dto.dueDate },
    });

    // Admin ga xabar
    NotifyService.debtCreated(debt, rental).catch(console.error);

    return debt;
  }

  // Qarzni to'lash
  static async pay(debtId: string, dto: PayDebtDTO, userId: string) {
    const debt = await Debt.findById(debtId).populate("client rental");
    if (!debt) throw new AppError("NOT_FOUND", "Qarz topilmadi", 404);
    if (debt.status === "paid") {
      throw new AppError("DEBT_ALREADY_PAID", "Qarz allaqachon to'langan", 400);
    }

    // To'lov yozish
    const payment = await Payment.create({
      rental: debt.rental._id,
      client: debt.client._id,
      amount: dto.amount,
      method: dto.method,
      note: dto.note ?? `Nasiya to'lovi`,
      createdBy: userId,
    });

    // Qarz yopish
    debt.status = dto.amount >= debt.amount ? "paid" : "pending";
    debt.paidDate = dto.amount >= debt.amount ? new Date() : undefined;
    if (dto.amount < debt.amount) {
      debt.amount = debt.amount - dto.amount; // qolgan qarz
    }
    await debt.save();

    // Client.totalDebt yangilash
    await ClientService.recalculateDebt(debt.client._id.toString());

    await audit({
      userId,
      action: "debt.paid",
      resourceType: "debt",
      resourceId: debt._id,
      resourceName: `Qarz to'lovi: ${formatMoney(dto.amount)}`,
      after: { amount: dto.amount, method: dto.method },
    });

    NotifyService.debtPaid(debt, payment).catch(console.error);

    return { debt, payment };
  }

  // Cron: overdue status yangilash
  static async updateOverdueDebts() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await Debt.updateMany(
      { status: "pending", dueDate: { $lt: today } },
      { $set: { status: "overdue" } },
    );

    // Overdue bo'lgan har biri uchun xabar
    if (result.modifiedCount > 0) {
      const overdue = await Debt.find({ status: "overdue" })
        .populate("client", "fullName phone telegramId")
        .populate("rental", "rentalNumber")
        .lean();

      for (const d of overdue) {
        NotifyService.debtOverdue(d).catch(console.error);
      }
    }

    return result.modifiedCount;
  }
}
```

---

## Debt Route

```typescript
// src/routes/debts.ts

// Barcha qarzlar
router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const filters = debtFilterSchema.parse(req.query);
    const result = await DebtService.getAll(filters);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Yangi qarz (manual — ixtiyoriy, odatda avtomatik)
router.post("/", authMiddleware, async (req, res, next) => {
  try {
    const dto = createDebtSchema.parse(req.body);
    const rental = await Rental.findById(dto.rentalId).populate("client");
    if (!rental) throw new AppError("NOT_FOUND", "Arenda topilmadi", 404);
    const check = CheckService.getCurrentCheck(rental);
    const debt = await DebtService.createFromRental(
      rental,
      check,
      dto,
      req.user._id,
    );
    res.status(201).json({ data: debt });
  } catch (err) {
    next(err);
  }
});

// Qarz to'lash
router.post("/:id/pay", authMiddleware, async (req, res, next) => {
  try {
    const dto = payDebtSchema.parse(req.body);
    const result = await DebtService.pay(req.params.id, dto, req.user._id);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});
```

---

## Cron Job

```typescript
// src/jobs/overdueCheck.ts
import cron from "node-cron";

export function startCronJobs() {
  // Har kuni 09:00 da
  cron.schedule(process.env.CRON_SCHEDULE ?? "0 9 * * *", async () => {
    console.log("[CRON] Overdue check boshlandi...");
    try {
      const rentals = await RentalService.updateOverdueStatuses();
      const debts = await DebtService.updateOverdueDebts();
      console.log(`[CRON] ${rentals} arenda, ${debts} qarz overdue bo'ldi`);
    } catch (err) {
      console.error("[CRON] Xato:", err);
    }
  });
}
```

---

## Frontend: Qarzdorlar sahifasi

```
/debts

┌─────────────────────────────────────┐
│  Qarzdorlar              [Hammasi▾] │
│  [Kutilmoqda] [Muddati o'tgan]     │
├─────────────────────────────────────┤
│  Sardor Yusupov                     │
│  ARN-2025-0003 • 450,000 so'm      │
│  Muddat: 10-iyul (1 kun qoldi) 🟡  │
│  [📞 Qo'ng'iroq]  [✅ To'landi]   │
├─────────────────────────────────────┤
│  Jasur Mirzayev                     │
│  ARN-2025-0001 • 280,000 so'm      │
│  Muddat: 25-iyun (4 kun o'tdi) 🔴  │
│  [📞 Qo'ng'iroq]  [✅ To'landi]   │
├─────────────────────────────────────┤
│  JAMI QARZ: 730,000 so'm           │
└─────────────────────────────────────┘
```

```tsx
// components/debt/DebtCard.tsx

export function DebtCard({ debt, onPay }) {
  const today = new Date();
  const isOverdue = debt.dueDate && new Date(debt.dueDate) < today;
  const daysLeft = debt.dueDate
    ? Math.ceil((new Date(debt.dueDate).getTime() - today.getTime()) / 86400000)
    : null;

  return (
    <div
      className={cn(
        "p-4 border rounded-xl",
        isOverdue && "border-destructive bg-destructive/5",
      )}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-semibold">{debt.client.fullName}</p>
          <p className="text-xs text-muted-foreground">
            {debt.rental.rentalNumber}
          </p>
        </div>
        <p className="font-bold text-destructive">{formatMoney(debt.amount)}</p>
      </div>

      {debt.dueDate && (
        <div className="flex items-center gap-1 text-xs mb-3">
          <Clock className="h-3 w-3" />
          <span className={isOverdue ? "text-destructive" : "text-amber-600"}>
            {isOverdue
              ? `${Math.abs(daysLeft!)} kun kechikdi`
              : daysLeft === 0
                ? "Bugun muddat"
                : `${daysLeft} kun qoldi`}
          </span>
        </div>
      )}

      <div className="flex gap-2">
        <a href={`tel:${debt.client.phone}`} className="flex-1">
          <Button variant="outline" size="sm" className="w-full">
            <Phone className="h-3 w-3 mr-1" />
            Qo'ng'iroq
          </Button>
        </a>
        <Button size="sm" className="flex-1" onClick={() => onPay(debt)}>
          <CheckCircle className="h-3 w-3 mr-1" />
          To'landi
        </Button>
      </div>
    </div>
  );
}
```

### PayDebtDialog

```tsx
// components/debt/PayDebtDialog.tsx

export function PayDebtDialog({ debt, open, onClose }) {
  const form = useForm({
    resolver: zodResolver(payDebtSchema),
    defaultValues: {
      amount: debt?.amount ?? 0,
      method: "cash",
      note: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (data) => api.post(`/debts/${debt._id}/pay`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      toast.success("To'lov qabul qilindi");
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Qarz to'lash</DialogTitle>
          <DialogDescription>
            {debt?.client.fullName} — {formatMoney(debt?.amount)}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(mutation.mutate)}
            className="space-y-4"
          >
            <FormField
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To'lov miqdori (so'm)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To'lov turi</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Naqd</SelectItem>
                      <SelectItem value="card">Karta</SelectItem>
                      <SelectItem value="transfer">O'tkazma</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Saqlanmoqda..." : "Tasdiqlash"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

---

## DTO (Zod)

```typescript
export const debtFilterSchema = z.object({
  status: z.enum(["pending", "paid", "overdue"]).optional(),
  clientId: z.string().length(24).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const payDebtSchema = z.object({
  amount: z.number().int().min(1, "To'lov 0 dan katta bo'lsin"),
  method: z.enum(["cash", "card", "transfer"]),
  note: z.string().max(200).optional(),
});
```
