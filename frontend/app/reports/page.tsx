"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle,
  Calendar,
  ClipboardList,
  Users,
  DollarSign,
  Package,
  TrendingUp,
  Plus,
  CheckCircle2,
  UserPlus,
  Trophy,
} from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";

const MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

export default function ReportsPage() {
  const { isAdmin } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["reports", "summary"],
    queryFn: reportsApi.getSummary,
  });

  const { data: monthly, isLoading: loadingMonthly } = useQuery({
    queryKey: ["reports", "monthly", year, month],
    queryFn: () => reportsApi.getMonthly(year, month),
  });

  const { data: overdue, isLoading: loadingOverdue } = useQuery({
    queryKey: ["reports", "overdue"],
    queryFn: reportsApi.getOverdue,
  });

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="p-4 text-center text-muted-foreground">Sizga ruxsat berilmagan</div>
      </AppLayout>
    );
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <h2 className="text-lg font-semibold">Hisobotlar</h2>

        <Tabs defaultValue="summary">
          <TabsList className="w-full">
            <TabsTrigger value="summary" className="flex-1">Umumiy</TabsTrigger>
            <TabsTrigger value="monthly" className="flex-1">Oylik</TabsTrigger>
            <TabsTrigger value="overdue" className="flex-1">Muddati o'tgan</TabsTrigger>
          </TabsList>

          {/* ── SUMMARY ── */}
          <TabsContent value="summary" className="mt-4 space-y-4">
            {loadingSummary ? (
              <div className="grid grid-cols-2 gap-3">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { title: "Faol arendalar", value: summary?.activeRentals ?? 0, icon: ClipboardList, color: "text-blue-600", bg: "bg-blue-100" },
                    { title: "Muddati o'tgan", value: summary?.overdueRentals ?? 0, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-100" },
                    { title: "Qarzdorlar", value: summary?.totalDebtors ?? 0, icon: Users, color: "text-orange-600", bg: "bg-orange-100" },
                    { title: "Jami qarz", value: formatCurrency(summary?.totalDebt ?? 0), icon: DollarSign, color: "text-purple-600", bg: "bg-purple-100" },
                    { title: "Ijarada", value: summary?.equipmentStats.totalOut ?? 0, icon: Package, color: "text-indigo-600", bg: "bg-indigo-100" },
                    { title: "Bo'sh", value: summary?.equipmentStats.totalAvailable ?? 0, icon: Package, color: "text-emerald-600", bg: "bg-emerald-100" },
                  ].map((stat) => (
                    <Card key={stat.title} className="border-0 shadow-sm">
                      <CardContent className="p-4">
                        <div className={`rounded-lg ${stat.bg} p-2 w-fit`}>
                          <stat.icon className={`h-5 w-5 ${stat.color}`} />
                        </div>
                        <div className="mt-3">
                          <p className="text-2xl font-bold truncate">{stat.value}</p>
                          <p className="text-xs text-muted-foreground">{stat.title}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Bugungi statistika
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: "Yangi arenda", value: summary?.todayStats.newRentals ?? 0, icon: Plus, color: "text-blue-500" },
                        { label: "Yopilgan", value: summary?.todayStats.closedRentals ?? 0, icon: CheckCircle2, color: "text-emerald-500" },
                        { label: "To'lovlar", value: formatCurrency(summary?.todayStats.paymentsReceived ?? 0), icon: DollarSign, color: "text-green-500" },
                        { label: "Yangi mijoz", value: summary?.todayStats.newClients ?? 0, icon: UserPlus, color: "text-purple-500" },
                      ].map((s) => (
                        <div key={s.label} className="flex items-center gap-2">
                          <s.icon className={`h-4 w-4 ${s.color}`} />
                          <div>
                            <p className="text-sm font-medium">{s.value}</p>
                            <p className="text-xs text-muted-foreground">{s.label}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ── MONTHLY ── */}
          <TabsContent value="monthly" className="mt-4 space-y-4">
            <div className="flex gap-2">
              <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, idx) => (
                    <SelectItem key={idx + 1} value={String(idx + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loadingMonthly ? (
              <div className="grid grid-cols-2 gap-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { title: "Daromad", value: formatCurrency(monthly?.revenue ?? 0), icon: DollarSign, color: "text-green-600", bg: "bg-green-100" },
                    { title: "To'lovlar", value: formatCurrency(monthly?.paymentsReceived ?? 0), icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-100" },
                    { title: "Yangi arenda", value: monthly?.newRentals ?? 0, icon: Plus, color: "text-indigo-600", bg: "bg-indigo-100" },
                    { title: "Yopilgan", value: monthly?.closedRentals ?? 0, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100" },
                    { title: "Yangi mijoz", value: monthly?.newClients ?? 0, icon: UserPlus, color: "text-purple-600", bg: "bg-purple-100" },
                  ].map((stat) => (
                    <Card key={stat.title} className="border-0 shadow-sm">
                      <CardContent className="p-4">
                        <div className={`rounded-lg ${stat.bg} p-2 w-fit`}>
                          <stat.icon className={`h-5 w-5 ${stat.color}`} />
                        </div>
                        <div className="mt-3">
                          <p className="text-2xl font-bold truncate">{stat.value}</p>
                          <p className="text-xs text-muted-foreground">{stat.title}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Trophy className="h-4 w-4" /> Top mijozlar
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {monthly?.topClients.length ? (
                        monthly.topClients.map((c, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="truncate mr-2">{i + 1}. {c.fullName}</span>
                            <span className="font-medium shrink-0">{formatCurrency(c.totalPaid)}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-4">Ma'lumot yo'q</p>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Package className="h-4 w-4" /> Top jihozlar
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {monthly?.topEquipment.length ? (
                        monthly.topEquipment.map((e, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="truncate mr-2">{i + 1}. {e.name}</span>
                            <span className="font-medium shrink-0">{e.rentalCount} marta</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-4">Ma'lumot yo'q</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {monthly && monthly.dailyRevenue.length > 0 && (() => {
                  const max = Math.max(...monthly.dailyRevenue.map((x) => x.amount), 1);
                  return (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Calendar className="h-4 w-4" /> Kunlik to'lovlar
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-end gap-[2px] h-24">
                        {monthly.dailyRevenue.map((d) => {
                          const h = Math.max((d.amount / max) * 100, d.amount > 0 ? 6 : 2);
                          return (
                            <div
                              key={d.date}
                              className="flex-1 rounded-t-sm bg-primary/70 hover:bg-primary transition-colors min-w-[2px]"
                              style={{ height: `${h}%` }}
                              title={`${formatDate(d.date)}: ${formatCurrency(d.amount)}`}
                            />
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                  );
                })()}
              </>
            )}
          </TabsContent>

          {/* ── OVERDUE ── */}
          <TabsContent value="overdue" className="mt-4 space-y-3">
            {loadingOverdue ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
              </div>
            ) : (
              <>
                {overdue && overdue.length > 0 && (
                  <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    {overdue.length} ta muddati o'tgan arenda
                  </div>
                )}
                {overdue?.map((item) => (
                  <Card key={item.rentalNumber}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{item.rentalNumber}</span>
                        <Badge variant="destructive">{item.overdueDays} kun</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p>{item.client.fullName} — {item.client.phone}</p>
                        <p className="flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3" />
                          Kutilgan: {formatDate(item.expectedEndDate)}
                        </p>
                        <div className="flex gap-2 mt-2">
                          {item.items.map((eq, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {eq.equipmentName}: {eq.activeQuantity} dona
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {(!overdue || overdue.length === 0) && (
                  <p className="text-center text-sm text-muted-foreground py-8">Muddati o'tgan arendalar yo'q</p>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
