"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { paymentsApi, rentalsApi } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, CreditCard, Search } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

const methodLabels: Record<string, string> = {
  cash: "Naqd",
  card: "Karta",
  transfer: "O'tkazma",
};

export default function PaymentsPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [rentalId, setRentalId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [search, setSearch] = useState("");

  const { data: payments, isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: () => paymentsApi.getAll({ limit: 50 }),
  });

  // Yopilmagan arendalar: `active` VA `overdue`. Ilgari faqat `active` olinardi,
  // ya'ni cron arendani `overdue` ga o'tkazgach — aynan qarzi bor arenda —
  // ro'yxatdan yo'qolib, unga to'lov kiritib bo'lmasdi.
  const { data: rentals } = useQuery({
    queryKey: ["rentals", "open"],
    queryFn: () => rentalsApi.getAll({ limit: 100 }),
    select: (res) => ({
      ...res,
      rentals: res.rentals.filter((r) => r.status !== "completed"),
    }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      paymentsApi.create({ rentalId, amount: parseInt(amount), method }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      toast.success("To'lov qo'shildi");
      setShowCreate(false);
      setAmount("");
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || "Xatolik"),
  });

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            To'lovlar
            {!isAdmin && (
              <span className="text-xs font-normal text-muted-foreground ml-2">
                (o'z arendalaringiz)
              </span>
            )}
          </h2>
          {/* Ilgari bu tugma faqat admin uchun edi — plan bo'yicha esa xodim
              ham to'lov kirita oladi va backend buni o'z arendasiga ruxsat beradi */}
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4" /> Yangi</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Yangi to'lov</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Arenda</Label>
                  <Select value={rentalId} onValueChange={setRentalId}>
                    <SelectTrigger><SelectValue placeholder="Arendani tanlang" /></SelectTrigger>
                    <SelectContent>
                      {rentals?.rentals?.map((r) => (
                        <SelectItem key={r._id} value={r._id}>
                          {r.rentalNumber} — {r.client.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Summa</Label>
                  <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Usul</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Naqd</SelectItem>
                      <SelectItem value="card">Karta</SelectItem>
                      <SelectItem value="transfer">O'tkazma</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  disabled={!rentalId || !amount || Number(amount) < 1 || createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                >
                  {createMutation.isPending ? "Kutilmoqda..." : "Qo'shish"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Mijoz ismi bo'yicha qidirish..."
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
            {payments?.data?.filter((p) => !search || p.client.fullName.toLowerCase().includes(search.toLowerCase())).map((payment) => (
              <Card key={payment._id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{formatCurrency(payment.amount)}</span>
                    <Badge variant="outline">{methodLabels[payment.method] || payment.method}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>{payment.client.fullName} — {payment.rental.rentalNumber}</p>
                    <p className="text-xs">{formatDateTime(payment.createdAt)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!payments?.data || payments.data.length === 0) && (
              <p className="text-center text-sm text-muted-foreground py-8">To'lovlar mavjud emas</p>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
