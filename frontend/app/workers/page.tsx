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
import { UserPlus, Shield, ShieldOff } from "lucide-react";
import { toast } from "sonner";

export default function WorkersPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [telegramId, setTelegramId] = useState("");

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
    </AppLayout>
  );
}
