cat > /home/claude/Docs/13-worker-audit.md << 'ENDOFFILE'

# 13 — Worker Audit

## Umumiy tushuncha

Har bir muhim amal AuditLog ga yoziladi.
Admin /settings/workers sahifasida har bir xodimning
barcha amallarini ko'rishi mumkin.

---

## AuditService

```typescript
// src/services/AuditService.ts

// Barcha service lar shu funksiyani chaqiradi
export async function audit(params: {
  userId: string | ObjectId;
  action: AuditAction;
  resourceType: string;
  resourceId?: string | ObjectId;
  resourceName?: string;
  before?: object;
  after?: object;
  note?: string;
}) {
  const user = await User.findById(params.userId).lean();
  await AuditLog.create({
    userId: params.userId,
    userFullName: user?.fullName ?? "Noma'lum",
    userRole: user?.role ?? "worker",
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    resourceName: params.resourceName,
    before: params.before,
    after: params.after,
    note: params.note,
  });
}

// Action turlari (type)
export type AuditAction =
  | "rental.create"
  | "rental.close"
  | "rental.return_items"
  | "rental.update"
  | "payment.create"
  | "payment.delete"
  | "client.create"
  | "client.update"
  | "equipment.create"
  | "equipment.update"
  | "equipment.price_change"
  | "equipment.quantity_adjust"
  | "user.create"
  | "user.block"
  | "user.unblock"
  | "debt.create"
  | "debt.paid"
  | "settings.update";

// AuditLog ni olish (admin uchun)
export class AuditService {
  static async getAll(filters: AuditFilters) {
    const query: any = {};
    if (filters.userId) query.userId = filters.userId;
    if (filters.action) query.action = filters.action;
    if (filters.resourceType) query.resourceType = filters.resourceType;
    if (filters.from || filters.to) {
      query.createdAt = {};
      if (filters.from) query.createdAt.$gte = new Date(filters.from);
      if (filters.to) query.createdAt.$lte = new Date(filters.to);
    }

    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .lean();

    return {
      data: logs,
      total,
      page: filters.page,
      totalPages: Math.ceil(total / filters.limit),
    };
  }

  // Bitta worker ning statistikasi
  static async getWorkerStats(userId: string) {
    const [rentalsCreated, paymentsAdded, clientsAdded, lastActivity] =
      await Promise.all([
        AuditLog.countDocuments({ userId, action: "rental.create" }),
        AuditLog.countDocuments({ userId, action: "payment.create" }),
        AuditLog.countDocuments({ userId, action: "client.create" }),
        AuditLog.findOne({ userId }).sort({ createdAt: -1 }).lean(),
      ]);

    return {
      rentalsCreated,
      paymentsAdded,
      clientsAdded,
      lastActivity: lastActivity?.createdAt ?? null,
    };
  }
}
```

---

## Frontend: Workers sahifasi (Settings ichida)

```
/settings/workers

┌─────────────────────────────────────┐
│  ← Xodimlar             [+ Qo'sh]  │
├─────────────────────────────────────┤
│  Bobur Toshmatov          🟢 Faol  │
│  @bobur_t • Worker                  │
│  12 arenda • 8 to'lov • 3 mijoz    │
│  Oxirgi: 28-iyun, 14:30            │
│  [Ko'rish] [Bloklash]              │
├─────────────────────────────────────┤
│  Jasur Qodirov            🔴 Bloklangan│
│  @jasur_q • Worker                  │
│  3 arenda • 2 to'lov • 1 mijoz     │
│  Oxirgi: 15-may, 09:10             │
│  [Ko'rish] [Faollashtirish]        │
└─────────────────────────────────────┘
```

```tsx
// app/settings/workers/page.tsx

export default function WorkersPage() {
  const { data: workers } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get("/users").then((r) => r.data.data),
  });

  return (
    <div className="pb-24">
      <PageHeader
        title="Xodimlar"
        back="/settings"
        action={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Qo'sh
          </Button>
        }
      />

      <div className="px-4 space-y-3 mt-4">
        {workers
          ?.filter((u) => u.role === "worker")
          .map((worker) => (
            <WorkerCard key={worker._id} worker={worker} />
          ))}
      </div>

      <AddWorkerSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
```

```tsx
// components/worker/WorkerCard.tsx

export function WorkerCard({ worker }) {
  const [statsOpen, setStatsOpen] = useState(false);
  const blockMutation = useBlockWorker(worker._id);

  return (
    <div className="p-4 border rounded-xl">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold">{worker.fullName}</p>
            <Badge
              variant={worker.isActive ? "default" : "destructive"}
              className="text-xs"
            >
              {worker.isActive ? "Faol" : "Bloklangan"}
            </Badge>
          </div>
          {worker.username && (
            <p className="text-sm text-muted-foreground">@{worker.username}</p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">ID: {worker.telegramId}</p>
      </div>

      {/* Mini statistika */}
      {worker.stats && (
        <div className="flex gap-4 text-xs text-muted-foreground mb-3">
          <span>{worker.stats.rentalsCreated} arenda</span>
          <span>{worker.stats.paymentsAdded} to'lov</span>
          <span>{worker.stats.clientsAdded} mijoz</span>
        </div>
      )}

      {worker.stats?.lastActivity && (
        <p className="text-xs text-muted-foreground mb-3">
          Oxirgi: {formatDateTime(worker.stats.lastActivity)}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => setStatsOpen(true)}
        >
          <Eye className="h-3 w-3 mr-1" />
          Audit
        </Button>
        <Button
          variant={worker.isActive ? "destructive" : "default"}
          size="sm"
          className="flex-1"
          onClick={() => blockMutation.mutate(!worker.isActive)}
        >
          {worker.isActive ? (
            <>
              <Ban className="h-3 w-3 mr-1" /> Bloklash
            </>
          ) : (
            <>
              <CheckCircle className="h-3 w-3 mr-1" /> Faollashtirish
            </>
          )}
        </Button>
      </div>

      {/* Audit log sheet */}
      <WorkerAuditSheet
        workerId={worker._id}
        workerName={worker.fullName}
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
      />
    </div>
  );
}
```

---

## Worker Audit Log Sheet

```tsx
// components/worker/WorkerAuditSheet.tsx

export function WorkerAuditSheet({ workerId, workerName, open, onClose }) {
  const [actionFilter, setActionFilter] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["audit", workerId, actionFilter],
    queryFn: () =>
      api
        .get(`/users/${workerId}/audit`, {
          params: { action: actionFilter || undefined, limit: 50 },
        })
        .then((r) => r.data),
    enabled: open,
  });

  const ACTION_LABELS: Record<string, string> = {
    "rental.create": "📋 Arenda ochdi",
    "rental.close": "✅ Arenda yopdi",
    "rental.return_items": "↩ Jihoz qaytardi",
    "payment.create": "💰 To'lov kiritdi",
    "client.create": "👤 Mijoz qo'shdi",
    "client.update": "✏ Mijoz yangiladi",
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[85vh]">
        <SheetHeader>
          <SheetTitle>{workerName} — Audit</SheetTitle>
        </SheetHeader>

        {/* Filter */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {["", "rental.create", "payment.create", "client.create"].map((a) => (
            <button
              key={a}
              onClick={() => setActionFilter(a)}
              className={cn(
                "px-3 py-1 rounded-full text-xs border whitespace-nowrap",
                actionFilter === a
                  ? "bg-primary text-primary-foreground border-primary"
                  : "",
              )}
            >
              {a === "" ? "Hammasi" : (ACTION_LABELS[a] ?? a)}
            </button>
          ))}
        </div>

        {/* Log ro'yxati */}
        <div className="mt-3 space-y-2 overflow-y-auto">
          {data?.data.map((log) => (
            <div key={log._id} className="flex gap-3 p-3 border rounded-lg">
              <div className="text-base">
                {ACTION_LABELS[log.action]?.split(" ")[0] ?? "•"}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {ACTION_LABELS[log.action]?.slice(2) ?? log.action}
                </p>
                {log.resourceName && (
                  <p className="text-xs text-muted-foreground">
                    {log.resourceName}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(log.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

---

## Xodim qo'shish formi

```tsx
// components/worker/AddWorkerSheet.tsx

const schema = z.object({
  telegramId: z
    .number({ invalid_type_error: "Raqam kiriting" })
    .int()
    .positive("Musbat son bo'lsin"),
  fullName: z.string().min(2, "Ism kerak"),
  username: z.string().optional(),
});

export function AddWorkerSheet({ open, onClose }) {
  const form = useForm({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (data) => api.post("/users", { ...data, role: "worker" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Xodim qo'shildi");
      onClose();
      form.reset();
    },
  });

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Yangi xodim qo'shish</SheetTitle>
          <SheetDescription>
            Xodim Telegram ID sini @userinfobot orqali bilib oling
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(mutation.mutate)}
            className="space-y-4 mt-4"
          >
            <FormField
              name="telegramId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telegram ID</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="123456789"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>
                    @userinfobot ga yozing — ID ni beradi
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ismi</FormLabel>
                  <FormControl>
                    <Input placeholder="Bobur Toshmatov" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username (ixtiyoriy)</FormLabel>
                  <FormControl>
                    <Input placeholder="@bobur_t" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Qo'shilmoqda..." : "Qo'shish"}
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
```

ENDOFFILE
