"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserPlus, Shield, ShieldOff, History } from "lucide-react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils";

/**
 * Audit yozuvlarining o'qiladigan nomlari. Ro'yxatda yo'q amal uchun
 * xom kalit ko'rsatiladi — bo'sh qatordan ko'ra tushunarli.
 */
const actionLabels: Record<string, string> = {
  "rental.create": "Arenda ochdi",
  "rental.return_items": "Jihoz qaytarib oldi",
  "rental.close": "Arendani yopdi",
  "rental.overdue": "Arenda muddati o'tdi",
  "payment.create": "To'lov kiritdi",
  "payment.delete": "To'lovni bekor qildi",
  "debt.pay": "Qarz to'lovi",
  "equipment.adjust_quantity": "Ombor miqdorini o'zgartirdi",
  "settings.create": "Sozlamalarni yaratdi",
  "settings.update": "Sozlamalarni o'zgartirdi",
};

export default function WorkersPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [telegramId, setTelegramId] = useState("");
  // Audit oynasi: qaysi xodimning tarixi ochilgan
  const [auditWorker, setAuditWorker] = useState<{ id: string; name: string } | null>(null);

  const { data: workers, isLoading } = useQuery({
    queryKey: ["users", { role: "WORKER" }],
    queryFn: () => usersApi.getAll({ role: "WORKER" }),
    enabled: isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      usersApi.create({
        telegramId: parseInt(telegramId),
        name,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Xodim qo'shildi");
      setShowCreate(false);
      setName("");
      setTelegramId("");
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.error?.message || "Xatolik yuz berdi"),
  });

  const { data: audit, isLoading: auditLoading } = useQuery({
    queryKey: ["audit", auditWorker?.id],
    queryFn: () => usersApi.getAudit(auditWorker!.id, { limit: 50 }),
    enabled: !!auditWorker,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (worker: { _id: string; isActive: boolean }) =>
      usersApi.update(worker._id, { isActive: !worker.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Holat o'zgartirildi");
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.error?.message || "Xatolik"),
  });

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="p-4 text-center text-muted-foreground">
          Sizga ruxsat berilmagan
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Xodimlar</h2>
            <p className="text-xs text-muted-foreground">
              Jami: {workers?.length ?? 0} ta
            </p>
          </div>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="h-4 w-4" /> Yangi
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Yangi xodim qo'shish</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Xodim Telegram orqali kirishi uchun uning Telegram ID sini
                  kiritishingiz kerak.
                </p>
                <div className="space-y-2">
                  <Label>Ism familya</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Bobur Toshmatov"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telegram ID</Label>
                  <Input
                    type="number"
                    value={telegramId}
                    onChange={(e) => setTelegramId(e.target.value)}
                    placeholder="123456789"
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={!name || !telegramId || createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                >
                  {createMutation.isPending
                    ? "Saqlanmoqda..."
                    : "Xodimni qo'shish"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {workers?.map((worker) => (
              <Card key={worker._id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{worker.name}</p>
                      <p className="text-xs text-muted-foreground">
                        ID: {worker.telegramId}
                        {worker.username && ` (@${worker.username})`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={worker.isActive ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {worker.isActive ? "Faol" : "Bloklangan"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Harakatlar tarixi"
                        onClick={() => setAuditWorker({ id: worker._id, name: worker.name })}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleActiveMutation.mutate(worker)}
                        title={
                          worker.isActive
                            ? "Bloklash"
                            : "Faollashtirish"
                        }
                      >
                        {worker.isActive ? (
                          <ShieldOff className="h-4 w-4 text-destructive" />
                        ) : (
                          <Shield className="h-4 w-4 text-green-500" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!workers || workers.length === 0) && (
              <p className="text-center text-sm text-muted-foreground py-8">
                Hali xodim yo'q
              </p>
            )}
          </div>
        )}
      </div>

      {/* Xodim auditi (plan: "Xodimlar auditi") */}
      <Dialog open={!!auditWorker} onOpenChange={(o) => !o && setAuditWorker(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{auditWorker?.name} — harakatlar tarixi</DialogTitle>
          </DialogHeader>

          {auditLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {audit?.data?.map((entry) => (
                <div key={entry._id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">
                      {actionLabels[entry.action] || entry.action}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDateTime(entry.createdAt)}
                    </span>
                  </div>
                  {entry.resourceName && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {entry.resourceName}
                    </p>
                  )}
                </div>
              ))}
              {(!audit?.data || audit.data.length === 0) && (
                <p className="text-center text-sm text-muted-foreground py-6">
                  Hali harakat qayd etilmagan
                </p>
              )}
              {audit && audit.total > audit.data.length && (
                <p className="text-center text-xs text-muted-foreground">
                  Oxirgi {audit.data.length} ta ko'rsatilmoqda ({audit.total} tadan)
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
