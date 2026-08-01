"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { rentalsApi, clientsApi, equipmentApi } from "@/lib/api";
import { createRentalSchema, type CreateRentalFormData, type CreateRentalFormInput } from "@/lib/validations";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, Trash2, MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import { toast } from "sonner";

// Leaflet faqat browserda ishlaydi — SSR o'chirilgan holda yuklaymiz
const MapPicker = dynamic(() => import("@/components/ui/map-picker"), {
  ssr: false,
  loading: () => (
    <div className="h-[260px] rounded-lg border flex items-center justify-center text-sm text-muted-foreground">
      Xarita yuklanmoqda...
    </div>
  ),
});

interface RentalItem {
  equipmentId: string;
  equipmentName: string;
  quantity: number;
  dailyRate: number;
  availableQty: number;
}

export default function NewRentalPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<RentalItem[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number; label?: string } | null>(null);
  const [locationLabel, setLocationLabel] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateRentalFormInput, any, CreateRentalFormData>({
    resolver: zodResolver(createRentalSchema),
    defaultValues: {
      startDate: new Date().toISOString().slice(0, 16),
      depositAmount: 0,
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: () => clientsApi.getAll({ limit: 100 }),
  });

  const { data: equipmentList } = useQuery({
    queryKey: ["equipment", "available"],
    queryFn: () => equipmentApi.getAll({ available: true }),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateRentalFormData) =>
      rentalsApi.create({
        clientId: data.clientId,
        items: items.map((i) => ({ equipmentId: i.equipmentId, quantity: i.quantity })),
        startDate: new Date(data.startDate).toISOString(),
        expectedEndDate: data.expectedEndDate ? new Date(data.expectedEndDate).toISOString() : undefined,
        depositAmount: data.depositAmount,
        note: data.note || undefined,
        deliveryLocation: location ? { ...location, label: locationLabel || undefined } : undefined,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      toast.success("Arenda yaratildi");
      router.push(`/rentals/${data._id}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || "Xatolik yuz berdi");
    },
  });

  const clientId = watch("clientId");

  const addItem = (equipmentId: string) => {
    const eq = equipmentList?.find((e) => e._id === equipmentId);
    if (!eq) return;
    if (items.find((i) => i.equipmentId === equipmentId)) {
      toast.error("Bu jihoz allaqachon qo'shilgan");
      return;
    }
    setItems([...items, { equipmentId, equipmentName: eq.name, quantity: 1, dailyRate: eq.dailyRate, availableQty: eq.availableQuantity }]);
  };

  const removeItem = (equipmentId: string) => {
    setItems(items.filter((i) => i.equipmentId !== equipmentId));
  };

  const updateItemQty = (equipmentId: string, quantity: number) => {
    const item = items.find((i) => i.equipmentId === equipmentId);
    if (item && quantity > item.availableQty) {
      toast.error(`Maksimal ${item.availableQty} dona mavjud`);
      return;
    }
    setItems(items.map((i) => (i.equipmentId === equipmentId ? { ...i, quantity } : i)));
  };

  const onSubmit = (data: CreateRentalFormData) => {
    if (items.length === 0) {
      toast.error("Kamida 1 ta jihoz qo'shing");
      return;
    }
    createMutation.mutate(data);
  };

  return (
    <AppLayout>
      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" type="button" onClick={() => router.back()}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold">Yangi arenda</h2>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Mijoz</Label>
            <Select value={clientId} onValueChange={(v) => setValue("clientId", v, { shouldValidate: true })}>
              <SelectTrigger><SelectValue placeholder="Mijozni tanlang" /></SelectTrigger>
              <SelectContent>
                {clients?.data?.map((c) => (
                  <SelectItem key={c._id} value={c._id}>{c.fullName} — {c.phone}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.clientId && <p className="text-xs text-destructive">{errors.clientId.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Boshlanish sanasi</Label>
              <Input type="datetime-local" {...register("startDate")} />
              {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Tugash sanasi</Label>
              <Input type="datetime-local" {...register("expectedEndDate")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Omonat (so'm)</Label>
            <Input type="number" placeholder="0" {...register("depositAmount")} />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Yetkazish joyi (ixtiyoriy)
            </Label>
            <MapPicker
              value={location}
              onChange={(loc) => setLocation(loc)}
            />
            <Input
              type="text"
              placeholder="Joy nomi (ixtiyoriy) — masalan: Chilonzor 12-uy"
              value={locationLabel}
              onChange={(e) => setLocationLabel(e.target.value)}
              className="mt-2"
            />
            <p className="text-[10px] text-muted-foreground">
              Xaritani bosib joylashuvni tanlang — mijoz mahsulotni qayerdan oladi
            </p>
          </div>

          <div className="space-y-2">
            <Label>Jihozlar</Label>
            <Select onValueChange={addItem}>
              <SelectTrigger><SelectValue placeholder="Jihoz qo'shish" /></SelectTrigger>
              <SelectContent>
                {equipmentList?.filter((e) => !items.find((i) => i.equipmentId === e._id)).map((eq) => (
                  <SelectItem key={eq._id} value={eq._id}>
                    {eq.name} ({eq.availableQuantity} dona, {eq.dailyRate.toLocaleString()} so'm/kun)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {items.map((item) => (
            <Card key={item.equipmentId}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.equipmentName}</p>
                  <p className="text-xs text-muted-foreground">{item.dailyRate.toLocaleString()} so'm/kun</p>
                  <p className="text-[10px] text-muted-foreground">Mavjud: {item.availableQty} dona</p>
                </div>
                <div className="flex flex-col items-center">
                  <Input
                    type="number"
                    min={1}
                    max={item.availableQty}
                    className="w-16 h-8 text-center"
                    value={item.quantity}
                    onChange={(e) => updateItemQty(item.equipmentId, parseInt(e.target.value) || 1)}
                  />
                  <span className="text-[10px] text-muted-foreground mt-0.5">/{item.availableQty}</span>
                </div>
                <Button variant="ghost" size="icon" type="button" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeItem(item.equipmentId)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}

          <div className="space-y-2">
            <Label>Eslatma</Label>
            <Textarea {...register("note")} placeholder="..." />
          </div>
        </div>

        <Separator />

        <Button className="w-full" disabled={createMutation.isPending} type="submit">
          {createMutation.isPending ? "Yaratilmoqda..." : "Arendani yaratish"}
        </Button>
      </form>
    </AppLayout>
  );
}
