"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Save } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    companyName: "", ownerName: "", address: "", phone: "",
    inn: "", bankAccount: "", bankName: "", rentalTerms: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: settingsApi.get,
    enabled: isAdmin,
  });

  React.useEffect(() => {
    if (data) {
      setForm({
        companyName: data.companyName || "",
        ownerName: data.ownerName || "",
        address: data.address || "",
        phone: data.phone || "",
        inn: data.inn || "",
        bankAccount: data.bankAccount || "",
        bankName: data.bankName || "",
        rentalTerms: data.rentalTerms || "",
      });
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: () => settingsApi.update(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Sozlamalar saqlandi");
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || "Xatolik"),
  });

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="p-4 text-center text-muted-foreground">Sizga ruxsat berilmagan</div>
      </AppLayout>
    );
  }

  const updateField = (field: string, value: string) => setForm({ ...form, [field]: value });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-4 space-y-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 space-y-4 pb-20">
        <h2 className="text-lg font-semibold">Sozlamalar</h2>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Kompaniya ma'lumotlari</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2"><Label>Kompaniya nomi</Label><Input value={form.companyName} onChange={(e) => updateField("companyName", e.target.value)} /></div>
            <div className="space-y-2"><Label>Direktor</Label><Input value={form.ownerName} onChange={(e) => updateField("ownerName", e.target.value)} /></div>
            <div className="space-y-2"><Label>Manzil</Label><Input value={form.address} onChange={(e) => updateField("address", e.target.value)} /></div>
            <div className="space-y-2"><Label>Telefon</Label><Input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Bank ma'lumotlari</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2"><Label>INN</Label><Input value={form.inn} onChange={(e) => updateField("inn", e.target.value)} /></div>
            <div className="space-y-2"><Label>Hisob raqam</Label><Input value={form.bankAccount} onChange={(e) => updateField("bankAccount", e.target.value)} /></div>
            <div className="space-y-2"><Label>Bank nomi</Label><Input value={form.bankName} onChange={(e) => updateField("bankName", e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Ijara shartlari</CardTitle></CardHeader>
          <CardContent>
            <Textarea rows={4} value={form.rentalTerms} onChange={(e) => updateField("rentalTerms", e.target.value)} />
          </CardContent>
        </Card>

        <Button className="w-full" onClick={() => updateMutation.mutate()}>
          <Save className="h-4 w-4" /> Saqlash
        </Button>
      </div>
    </AppLayout>
  );
}
