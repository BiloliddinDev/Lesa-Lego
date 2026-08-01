"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clientsApi } from "@/lib/api";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

export default function NewClientPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("+998");
  const [note, setNote] = useState("");

  const createMutation = useMutation({
    mutationFn: () => clientsApi.create({ fullName, phone, note: note || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Mijoz qo'shildi");
      router.push("/clients");
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || "Xatolik"),
  });

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold">Yangi mijoz</h2>
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Ism familya</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Alisher Karimov" />
          </div>
          <div className="space-y-2">
            <Label>Telefon</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998901234567" />
          </div>
          <div className="space-y-2">
            <Label>Eslatma</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <Button
          className="w-full"
          disabled={!fullName || !phone || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? "Saqlanmoqda..." : "Mijozni qo'shish"}
        </Button>
      </div>
    </AppLayout>
  );
}
