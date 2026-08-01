"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { debtsApi } from "@/lib/api";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
};

const statusLabels: Record<string, string> = {
  pending: "Kutilmoqda",
  paid: "To'langan",
  overdue: "Muddati o'tgan",
};

export default function DebtsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [payModal, setPayModal] = useState<{ debtId: string; open: boolean }>({ debtId: "", open: false });
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");

  const { data, isLoading } = useQuery({
    queryKey: ["debts", { status }],
    queryFn: () => debtsApi.getAll({ status, limit: 50 }),
  });

  const payMutation = useMutation({
    mutationFn: (debtId: string) =>
      debtsApi.pay(debtId, { amount: parseInt(payAmount), method: payMethod }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast.success("Qarz to'landi");
      setPayModal({ debtId: "", open: false });
      setPayAmount("");
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || "Xatolik"),
  });

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <h2 className="text-lg font-semibold">Qarzlar</h2>

        <Tabs defaultValue="all" onValueChange={(v) => setStatus(v === "all" ? undefined : v)}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">Barchasi</TabsTrigger>
            <TabsTrigger value="pending" className="flex-1">Kutilmoqda</TabsTrigger>
            <TabsTrigger value="overdue" className="flex-1">Muddati o'tgan</TabsTrigger>
            <TabsTrigger value="paid" className="flex-1">To'langan</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {data?.data?.map((debt) => (
              <Card key={debt._id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{debt.client.fullName}</span>
                    <Badge className={statusColors[debt.status]}>{statusLabels[debt.status]}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>{debt.rental.rentalNumber} — {formatCurrency(debt.amount)}</p>
                    {debt.dueDate && <p>Muddat: {formatDate(debt.dueDate)}</p>}
                    {debt.status === "pending" && (
                      <Button
                        size="sm"
                        className="mt-2"
                        onClick={() => setPayModal({ debtId: debt._id, open: true })}
                      >
                        <DollarSign className="h-4 w-4" /> To'lash
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!data?.data || data.data.length === 0) && (
              <p className="text-center text-sm text-muted-foreground py-8">Qarzlar mavjud emas</p>
            )}
          </div>
        )}
      </div>

      <Dialog open={payModal.open} onOpenChange={(o) => setPayModal({ ...payModal, open: o })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Qarzni to'lash</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Summa</Label>
              <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Usul</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Naqd</SelectItem>
                  <SelectItem value="card">Karta</SelectItem>
                  <SelectItem value="transfer">O'tkazma</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={() => payMutation.mutate(payModal.debtId)}>
              {payMutation.isPending ? "Kutilmoqda..." : "To'lash"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
