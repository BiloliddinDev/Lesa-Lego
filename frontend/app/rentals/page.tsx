"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { rentalsApi } from "@/lib/api";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const statusColors: Record<string, string> = {
  active: "bg-blue-100 text-blue-700 hover:bg-blue-200",
  overdue: "bg-red-100 text-red-700 hover:bg-red-200",
  completed: "bg-green-100 text-green-700 hover:bg-green-200",
};

const statusLabels: Record<string, string> = {
  active: "Faol",
  overdue: "Muddati o'tgan",
  completed: "Yopilgan",
};

export default function RentalsPage() {
  const router = useRouter();
  const { isAdmin, user } = useAuth();
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["rentals", { status, isAdmin }],
    queryFn: () =>
      rentalsApi.getAll({
        status,
        createdBy: isAdmin ? undefined : user?._id,
      }),
  });

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Arendalar
            {!isAdmin && (
              <span className="text-xs font-normal text-muted-foreground ml-2">
                (faqat sizniki)
              </span>
            )}
          </h2>
          <Button size="sm" onClick={() => router.push("/rentals/new")}>
            <Plus className="h-4 w-4" />
            Yangi
          </Button>
        </div>

        <Tabs defaultValue="all" onValueChange={(v) => setStatus(v === "all" ? undefined : v)}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">Barchasi</TabsTrigger>
            <TabsTrigger value="active" className="flex-1">Faol</TabsTrigger>
            <TabsTrigger value="overdue" className="flex-1">Muddati o'tgan</TabsTrigger>
            <TabsTrigger value="completed" className="flex-1">Yopilgan</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Qidirish..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {data?.rentals
              ?.filter((r) => !search || r.rentalNumber.includes(search) || r.client.fullName.toLowerCase().includes(search.toLowerCase()))
              .map((rental) => (
              <Card key={rental._id} className="cursor-pointer transition-colors hover:bg-accent/50" onClick={() => router.push(`/rentals/${rental._id}`)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{rental.rentalNumber}</span>
                    <Badge className={statusColors[rental.status]}>
                      {statusLabels[rental.status]}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>{rental.client.fullName} — {rental.client.phone}</p>
                    <div className="flex justify-between mt-1">
                      <span>{formatDate(rental.startDate)}</span>
                      <span className="font-medium text-foreground">
                        Omonat: {formatCurrency(rental.depositAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span>{rental.items.length} ta jihoz</span>
                      <span>To'lov: {formatCurrency(rental.paidAmount)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!data?.rentals || data.rentals.length === 0) && (
              <p className="text-center text-sm text-muted-foreground py-8">
                {isAdmin
                  ? "Arendalar mavjud emas"
                  : "Sizning arendalaringiz yo'q"}
              </p>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
