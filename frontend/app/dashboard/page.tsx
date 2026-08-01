"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { reportsApi, rentalsApi } from "@/lib/api";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ClipboardList,
  AlertTriangle,
  Users,
  DollarSign,
  Package,
  Activity,
  Plus,
  CheckCircle2,
  UserPlus,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function DashboardPage() {
  const { isAdmin, user } = useAuth();

  // Admin: full summary. Worker: faqat o'z arendalari
  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["reports", "summary"],
    queryFn: reportsApi.getSummary,
    enabled: isAdmin,
  });

  const { data: myRentals } = useQuery({
    queryKey: ["rentals", { createdBy: user?._id }],
    queryFn: () => rentalsApi.getAll({ createdBy: user?._id, limit: 5 }),
    enabled: !isAdmin && !!user,
  });

  const isLoading = isAdmin ? loadingSummary : false;

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">
            Xush kelibsiz, {user?.name}
          </h2>
          <p className="text-xs text-muted-foreground">
            {user?.role === "ADMIN" ? "Admin" : "Xodim"} paneli
          </p>
        </div>

        {/* ADMIN: full dashboard */}
        {isAdmin && (
          <>
            {loadingSummary ? (
              <div className="grid grid-cols-2 gap-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
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
                          <p className="text-2xl font-bold">{stat.value}</p>
                          <p className="text-xs text-muted-foreground">{stat.title}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="h-4 w-4" />
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
          </>
        )}

        {/* WORKER: o'zining so'ngi arendalari */}
        {!isAdmin && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Sizning arendalaringiz</h3>
            {myRentals?.rentals?.map((rental) => (
              <Card key={rental._id}>
                <CardContent className="p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-sm">{rental.rentalNumber}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      rental.status === "active" ? "bg-blue-100 text-blue-700" :
                      rental.status === "overdue" ? "bg-red-100 text-red-700" :
                      "bg-green-100 text-green-700"
                    }`}>
                      {rental.status === "active" ? "Faol" : rental.status === "overdue" ? "Muddati o'tgan" : "Yopilgan"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{rental.client.fullName}</p>
                </CardContent>
              </Card>
            ))}
            {(!myRentals?.rentals || myRentals.rentals.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Hali arendalaringiz yo'q
              </p>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
