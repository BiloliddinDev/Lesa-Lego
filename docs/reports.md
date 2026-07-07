cat > /home/claude/Docs/12-reports.md << 'ENDOFFILE'

# 12 — Hisobotlar (Reports)

## ReportService

```typescript
// src/services/ReportService.ts

export class ReportService {
  // ─── Dashboard summary ──────────────────────────────────
  static async getSummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      activeRentals,
      overdueRentals,
      allEquipment,
      todayRentals,
      todayPayments,
      todayClients,
    ] = await Promise.all([
      Rental.countDocuments({ status: "active" }),
      Rental.countDocuments({ status: "overdue" }),
      Equipment.find({ isActive: true }).lean(),
      Rental.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
      Payment.aggregate([
        { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Client.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
    ]);

    // Qarzdorlar
    const debtors = await Client.countDocuments({ totalDebt: { $gt: 0 } });
    const totalDebtAgg = await Client.aggregate([
      { $match: { totalDebt: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: "$totalDebt" } } },
    ]);

    // Equipment statistika
    const totalOut = allEquipment.reduce((s, e) => s + e.rentedQuantity, 0);
    const totalAvail = allEquipment.reduce(
      (s, e) => s + (e.totalQuantity - e.rentedQuantity),
      0,
    );

    return {
      today: today.toISOString().split("T")[0],
      activeRentals,
      overdueRentals,
      totalDebtors: debtors,
      totalDebt: totalDebtAgg[0]?.total ?? 0,
      equipmentStats: { totalOut, totalAvailable: totalAvail },
      todayStats: {
        newRentals: todayRentals,
        paymentsReceived: todayPayments[0]?.total ?? 0,
        newClients: todayClients,
      },
    };
  }

  // ─── Oylik hisobot ──────────────────────────────────────
  static async getMonthly(year: number, month: number) {
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1);

    const [rentals, payments, newClients] = await Promise.all([
      Rental.find({ createdAt: { $gte: from, $lt: to } })
        .populate("client", "fullName")
        .lean(),
      Payment.find({ createdAt: { $gte: from, $lt: to } })
        .populate("client", "fullName")
        .lean(),
      Client.countDocuments({ createdAt: { $gte: from, $lt: to } }),
    ]);

    const revenue = payments.reduce((s, p) => s + p.amount, 0);
    const closedRentals = rentals.filter(
      (r) => r.status === "completed",
    ).length;

    // Kunlik daromad (to'lovlar bo'yicha)
    const dailyMap: Record<string, number> = {};
    payments.forEach((p) => {
      const day = p.createdAt.toISOString().split("T")[0];
      dailyMap[day] = (dailyMap[day] ?? 0) + p.amount;
    });
    const dailyRevenue = Object.entries(dailyMap)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Eng ko'p to'lagan mijozlar
    const clientMap: Record<string, { name: string; total: number }> = {};
    payments.forEach((p) => {
      const id = (p.client as any)._id.toString();
      if (!clientMap[id]) {
        clientMap[id] = { name: (p.client as any).fullName, total: 0 };
      }
      clientMap[id].total += p.amount;
    });
    const topClients = Object.values(clientMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Eng ko'p arendaga chiqqan jihozlar
    const eqMap: Record<string, { name: string; count: number }> = {};
    rentals.forEach((r) => {
      r.items.forEach((item) => {
        const name = item.equipmentName;
        if (!eqMap[name]) eqMap[name] = { name, count: 0 };
        eqMap[name].count++;
      });
    });
    const topEquipment = Object.values(eqMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      period: `${year}-${String(month).padStart(2, "0")}`,
      revenue,
      newRentals: rentals.length,
      closedRentals,
      newClients,
      paymentsReceived: revenue,
      dailyRevenue,
      topClients,
      topEquipment,
    };
  }

  // ─── Overdue ro'yxati ───────────────────────────────────
  static async getOverdue() {
    const today = new Date();
    const rentals = await Rental.find({ status: "overdue" })
      .populate("client", "fullName phone telegramId")
      .lean();

    return rentals.map((r) => {
      const overdueDays = r.expectedEndDate
        ? Math.ceil((today.getTime() - r.expectedEndDate.getTime()) / 86400000)
        : 0;
      const check = CheckService.getCurrentCheck(r as any);

      return {
        rentalNumber: r.rentalNumber,
        client: r.client,
        expectedEndDate: r.expectedEndDate,
        overdueDays,
        currentDebt: check.debt,
        items: r.items
          .filter((i) => i.returnedQuantity < i.quantity)
          .map((i) => ({
            equipmentName: i.equipmentName,
            activeQuantity: i.quantity - i.returnedQuantity,
          })),
      };
    });
  }
}
```

---

## Frontend: Dashboard (bosh sahifa)

```
/   (Dashboard)

┌─────────────────────────────────────┐
│  Lesa Lego            29-iyun 2025  │
├─────────────────────────────────────┤
│  BUGUN                              │
│  ┌──────────┬──────────┬─────────┐ │
│  │    2     │ 850,000  │    1    │ │
│  │ Yangi    │  Tushum  │ Yangi   │ │
│  │ arenda   │  so'm    │ mijoz   │ │
│  └──────────┴──────────┴─────────┘ │
├─────────────────────────────────────┤
│  UMUMIY HOLAT                       │
│  ┌──────────┬──────────┐           │
│  │    7     │    2     │           │
│  │  Faol    │ Muddati  │           │
│  │ arenda   │  o'tgan  │           │
│  └──────────┴──────────┘           │
│  ┌──────────┬──────────┐           │
│  │  42 ta   │  28 ta   │           │
│  │ Arenda   │ Mavjud   │           │
│  │   da     │          │           │
│  └──────────┴──────────┘           │
├─────────────────────────────────────┤
│  🔴 2 ta muddati o'tgan arenda     │
│  ↗ Ko'rish                         │
├─────────────────────────────────────┤
│  💰 Jami qarz: 3,250,000 so'm      │
│  5 ta qarzdor  ↗ Ko'rish           │
└─────────────────────────────────────┘
```

```tsx
// app/page.tsx — Dashboard

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: summary, isLoading } = useQuery({
    queryKey: queryKeys.reports.summary,
    queryFn: () => api.get("/reports/summary").then((r) => r.data.data),
    refetchInterval: 60_000, // har daqiqada yangilanadi
  });

  return (
    <div className="pb-24 space-y-4">
      {/* Header */}
      <div className="px-4 pt-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">Lesa Lego</h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(new Date())}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Salom,</p>
          <p className="text-sm font-medium">{user?.fullName}</p>
        </div>
      </div>

      {/* Bugungi statistika */}
      <div className="px-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
          Bugun
        </p>
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Yangi arenda"
            value={summary?.todayStats.newRentals ?? 0}
            icon={FileText}
          />
          <StatCard
            label="Tushum"
            value={formatMoney(summary?.todayStats.paymentsReceived ?? 0)}
            icon={TrendingUp}
            className="text-green-600"
          />
          <StatCard
            label="Yangi mijoz"
            value={summary?.todayStats.newClients ?? 0}
            icon={UserPlus}
          />
        </div>
      </div>

      {/* Umumiy holat */}
      <div className="px-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
          Umumiy holat
        </p>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Faol arenda" value={summary?.activeRentals ?? 0} />
          <StatCard
            label="Muddati o'tgan"
            value={summary?.overdueRentals ?? 0}
            className={summary?.overdueRentals ? "text-destructive" : ""}
          />
          <StatCard
            label="Arendada"
            value={`${summary?.equipmentStats.totalOut ?? 0} ta`}
          />
          <StatCard
            label="Mavjud"
            value={`${summary?.equipmentStats.totalAvailable ?? 0} ta`}
            className="text-green-600"
          />
        </div>
      </div>

      {/* Overdue alert */}
      {summary?.overdueRentals > 0 && (
        <Link href="/rentals?status=overdue" className="block px-4">
          <div className="flex items-center justify-between p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <p className="text-sm font-medium text-destructive">
                {summary.overdueRentals} ta muddati o'tgan arenda
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-destructive" />
          </div>
        </Link>
      )}

      {/* Qarz alert */}
      {summary?.totalDebt > 0 && (
        <Link href="/debts" className="block px-4">
          <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <div>
              <p className="text-sm font-medium text-amber-800">
                Jami qarz: {formatMoney(summary.totalDebt)}
              </p>
              <p className="text-xs text-amber-600">
                {summary.totalDebtors} ta qarzdor
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-amber-600" />
          </div>
        </Link>
      )}

      {/* Tez harakatlar */}
      <div className="px-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
          Tez harakatlar
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/rentals/new">
            <Button className="w-full h-14 flex-col gap-1" variant="outline">
              <Plus className="h-5 w-5" />
              <span className="text-xs">Yangi arenda</span>
            </Button>
          </Link>
          <Link href="/clients/new">
            <Button className="w-full h-14 flex-col gap-1" variant="outline">
              <UserPlus className="h-5 w-5" />
              <span className="text-xs">Yangi mijoz</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
```

---

## Frontend: Oylik hisobot sahifasi

```
/reports

┌─────────────────────────────────────┐
│  Hisobotlar                         │
│  ← Iyun 2025 →                     │
├─────────────────────────────────────┤
│  DAROMAD                            │
│  12,500,000 so'm                    │
│  ████████████░░░░ (grafik)         │
├─────────────────────────────────────┤
│  ┌──────┬──────┬──────┬──────┐    │
│  │  18  │  15  │  6   │      │    │
│  │Yangi │Tugad │Yangi │      │    │
│  │arend │ ildi │mijoz │      │    │
│  └──────┴──────┴──────┴──────┘    │
├─────────────────────────────────────┤
│  TOP MIJOZLAR                       │
│  1. Vohid Rahimov   1,500,000 so'm │
│  2. Alisher Karimov 1,200,000 so'm │
│  3. Sardor Yusupov    980,000 so'm │
├─────────────────────────────────────┤
│  ENG KO'P ARENDA QILINGAN          │
│  1. Lesa A-seriya 2m   8 marta     │
│  2. Apalofka kichik    6 marta     │
└─────────────────────────────────────┘
```

```tsx
// app/reports/page.tsx

export default function ReportsPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.reports.monthly(year, month),
    queryFn: () =>
      api
        .get(`/reports/monthly?year=${year}&month=${month}`)
        .then((r) => r.data.data),
  });

  return (
    <div className="pb-24">
      <PageHeader title="Hisobotlar" />

      {/* Oy tanlash */}
      <div className="flex items-center justify-center gap-4 px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => prevMonth()}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="font-semibold text-base">
          {MONTHS_UZ[month - 1]} {year}
        </p>
        <Button variant="ghost" size="icon" onClick={() => nextMonth()}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Asosiy daromad */}
      <div className="mx-4 p-4 bg-primary rounded-xl text-primary-foreground mb-4">
        <p className="text-sm opacity-80">Jami tushum</p>
        <p className="text-3xl font-bold">{formatMoney(data?.revenue ?? 0)}</p>
      </div>

      {/* Kunlik grafik */}
      {data?.dailyRevenue && (
        <div className="px-4 mb-4">
          <p className="text-sm font-medium mb-2">Kunlik daromad</p>
          <SimpleBarChart data={data.dailyRevenue} />
        </div>
      )}

      {/* Statistika */}
      <div className="grid grid-cols-3 gap-3 px-4 mb-4">
        <StatCard label="Yangi arenda" value={data?.newRentals ?? 0} />
        <StatCard label="Tugadirildi" value={data?.closedRentals ?? 0} />
        <StatCard label="Yangi mijoz" value={data?.newClients ?? 0} />
      </div>

      {/* Top mijozlar */}
      <div className="px-4 mb-4">
        <p className="text-sm font-medium mb-2">Top mijozlar</p>
        {data?.topClients.map((c, i) => (
          <div
            key={i}
            className="flex justify-between py-2 border-b last:border-0"
          >
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">{i + 1}.</span>
              <span className="text-sm">{c.name}</span>
            </div>
            <span className="text-sm font-medium">{formatMoney(c.total)}</span>
          </div>
        ))}
      </div>

      {/* Top jihozlar */}
      <div className="px-4">
        <p className="text-sm font-medium mb-2">
          Ko'p arendaga chiqqan jihozlar
        </p>
        {data?.topEquipment.map((e, i) => (
          <div
            key={i}
            className="flex justify-between py-2 border-b last:border-0"
          >
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">{i + 1}.</span>
              <span className="text-sm">{e.name}</span>
            </div>
            <span className="text-sm font-medium">{e.count} marta</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const MONTHS_UZ = [
  "Yanvar",
  "Fevral",
  "Mart",
  "Aprel",
  "May",
  "Iyun",
  "Iyul",
  "Avgust",
  "Sentabr",
  "Oktabr",
  "Noyabr",
  "Dekabr",
];
```

ENDOFFILE
Output
