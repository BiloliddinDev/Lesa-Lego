"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clientsApi, rentalsApi } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, Phone, ClipboardList, Pencil } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNote, setEditNote] = useState("");

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: () => clientsApi.getById(id),
  });

  const { data: rentals } = useQuery({
    queryKey: ["rentals", { clientId: id }],
    queryFn: () => rentalsApi.getAll({ clientId: id, limit: 50 }),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      clientsApi.update(id, {
        fullName: editName,
        phone: editPhone,
        note: editNote || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client", id] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Mijoz yangilandi");
      setShowEdit(false);
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.error?.message || "Xatolik yuz berdi"),
  });

  const openEdit = () => {
    if (!client) return;
    setEditName(client.fullName);
    setEditPhone(client.phone);
    setEditNote(client.note || "");
    setShowEdit(true);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-4 space-y-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      </AppLayout>
    );
  }

  if (!client) {
    return (
      <AppLayout>
        <div className="p-4 text-center text-muted-foreground">Mijoz topilmadi</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 space-y-4 pb-20">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold flex-1 truncate">{client.fullName}</h2>
          {isAdmin && (
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={openEdit}>
              <Pencil className="h-3.5 w-3.5" /> Tahrirlash
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <a href={`tel:${client.phone}`} className="text-primary">{client.phone}</a>
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm text-muted-foreground">Jami qarz</span>
              <span className={`font-bold ${client.totalDebt > 0 ? "text-destructive" : "text-green-600"}`}>
                {formatCurrency(client.totalDebt)}
              </span>
            </div>
            {client.note && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1">Eslatma</p>
                <p className="text-sm">{client.note}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Arendalar tarixi
          </h3>
          <div className="space-y-2">
            {rentals?.rentals?.map((rental) => (
              <Card
                key={rental._id}
                className="cursor-pointer transition-colors hover:bg-accent/50"
                onClick={() => router.push(`/rentals/${rental._id}`)}
              >
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{rental.rentalNumber}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(rental.startDate)}</p>
                  </div>
                  <Badge variant={rental.status === "active" ? "default" : rental.status === "overdue" ? "destructive" : "secondary"}>
                    {rental.status === "active" ? "Faol" : rental.status === "overdue" ? "Muddati o'tgan" : "Yopilgan"}
                  </Badge>
                </CardContent>
              </Card>
            ))}
            {(!rentals?.rentals || rentals.rentals.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">Arendalar mavjud emas</p>
            )}
          </div>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" /> Mijozni tahrirlash
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ism familya</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Alisher Karimov" />
            </div>
            <div className="space-y-2">
              <Label>Telefon</Label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+998901234567" />
            </div>
            <div className="space-y-2">
              <Label>Eslatma</Label>
              <Textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} rows={2} />
            </div>
            <Button
              className="w-full"
              disabled={!editName || !editPhone || updateMutation.isPending}
              onClick={() => updateMutation.mutate()}
            >
              {updateMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
