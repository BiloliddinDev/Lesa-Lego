"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { clientsApi } from "@/lib/api";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Phone } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function ClientsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["clients", { search }],
    queryFn: () => clientsApi.getAll({ search: search || undefined, limit: 50 }),
  });

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Mijozlar</h2>
          <Button size="sm" onClick={() => router.push("/clients/new")}>
            <Plus className="h-4 w-4" /> Yangi
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Ism yoki telefon raqam..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {data?.data?.map((client) => (
              <Card key={client._id} className="cursor-pointer transition-colors hover:bg-accent/50" onClick={() => router.push(`/clients/${client._id}`)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{client.fullName}</span>
                    {client.totalDebt > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {formatCurrency(client.totalDebt)}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{client.phone}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!data?.data || data.data.length === 0) && (
              <p className="text-center text-sm text-muted-foreground py-8">
                {search ? "Mijoz topilmadi" : "Hali mijoz yo'q"}
              </p>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
