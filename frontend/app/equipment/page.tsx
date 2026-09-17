"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { equipmentApi, categoriesApi, rentalsApi, clientsApi } from "@/lib/api";
import type { Equipment } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Package, FolderPlus, ShoppingCart, Warehouse, History, User, Calendar, ArrowRight, CheckCircle2, XCircle, Pencil, EyeOff, MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

// Leaflet faqat browserda ishlaydi — SSR o'chirilgan holda yuklaymiz
const MapPicker = dynamic(() => import("@/components/ui/map-picker"), {
  ssr: false,
  loading: () => (
    <div className="h-[240px] rounded-lg border flex items-center justify-center text-sm text-muted-foreground">
      Xarita yuklanmoqda...
    </div>
  ),
});

export default function EquipmentPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [showCreate, setShowCreate] = useState(false);
  const [showCatCreate, setShowCatCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCatId, setNewCatId] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [newRate, setNewRate] = useState("0");
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");

  // Edit dialog state
  const [showEdit, setShowEdit] = useState(false);
  // Ombor miqdorini sozlash: sabab bilan (+ kirim / - chiqim), audit logga tushadi
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustValue, setAdjustValue] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [editingEq, setEditingEq] = useState<Equipment | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editRate, setEditRate] = useState("0");
  const [editQty, setEditQty] = useState("0");
  const [editActive, setEditActive] = useState(true);

  // History dialog state
  const [showHistory, setShowHistory] = useState(false);
  const [historyEqId, setHistoryEqId] = useState<string | null>(null);
  const [historyEqName, setHistoryEqName] = useState("");

  // Quick rental dialog state
  const [showRental, setShowRental] = useState(false);
  const [rentalEq, setRentalEq] = useState<{ id: string; name: string; maxQty: number; rate: number } | null>(null);
  const [rentalClientId, setRentalClientId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [rentalQty, setRentalQty] = useState("1");
  const [rentalStartDate, setRentalStartDate] = useState(new Date().toISOString().slice(0, 16));
  const [rentalDeposit, setRentalDeposit] = useState("");
  const [rentalLocation, setRentalLocation] = useState<{ lat: number; lng: number; label?: string } | null>(null);
  const [rentalLocationLabel, setRentalLocationLabel] = useState("");

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: categoriesApi.getAll,
  });

  const { data: equipment, isLoading } = useQuery({
    queryKey: ["equipment", { categoryId }],
    queryFn: () => equipmentApi.getAll({ categoryId }),
  });

  // Mijozlar server tomonda qidiriladi. Ilgari faqat birinchi 100 ta
  // yuklanardi va mijoz ko'paygach ro'yxatdan topib bo'lmasdi.
  const { data: clients } = useQuery({
    queryKey: ["clients", { search: clientSearch }],
    queryFn: () => clientsApi.getAll({ search: clientSearch || undefined, limit: 50 }),
  });

  // Equipment history query
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["equipment", historyEqId, "history"],
    queryFn: () => equipmentApi.getHistory(historyEqId!),
    enabled: !!historyEqId,
  });

  // Create rental mutation
  const createRentalMutation = useMutation({
    mutationFn: () =>
      rentalsApi.create({
        clientId: rentalClientId,
        items: [
          {
            equipmentId: rentalEq!.id,
            quantity: parseInt(rentalQty),
          },
        ],
        startDate: new Date(rentalStartDate).toISOString(),
        depositAmount: rentalDeposit ? parseInt(rentalDeposit) : 0,
        deliveryLocation: rentalLocation
          ? { ...rentalLocation, label: rentalLocationLabel || undefined }
          : undefined,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      toast.success("Arenda ochildi");
      setShowRental(false);
      setRentalEq(null);
      setRentalClientId("");
      setRentalQty("1");
      router.push(`/rentals/${data._id}`);
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.error?.message || "Xatolik"),
  });

  const createEquipmentMutation = useMutation({
    mutationFn: () =>
      equipmentApi.create({
        categoryId: newCatId,
        name: newName,
        totalQuantity: parseInt(newQty),
        dailyRate: parseInt(newRate),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      toast.success("Jihoz qo'shildi");
      setShowCreate(false);
      setNewName("");
      setNewCatId("");
      setNewQty("1");
      setNewRate("0");
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.error?.message || "Xatolik"),
  });

  const updateEquipmentMutation = useMutation({
    mutationFn: () =>
      equipmentApi.update(editingEq!._id, {
        name: editName,
        description: editDesc || undefined,
        totalQuantity: parseInt(editQty),
        dailyRate: parseInt(editRate),
        isActive: editActive,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      toast.success("Jihoz tahrirlandi");
      setShowEdit(false);
      setEditingEq(null);
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.error?.message || "Xatolik"),
  });

  const adjustQuantityMutation = useMutation({
    mutationFn: () =>
      equipmentApi.adjustQuantity(editingEq!._id, parseInt(adjustValue), adjustReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      toast.success("Ombor miqdori o'zgartirildi");
      setShowAdjust(false);
      setAdjustValue("");
      setAdjustReason("");
      setEditingEq(null);
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.error?.message || "Xatolik"),
  });

  const createCategoryMutation = useMutation({
    mutationFn: () =>
      categoriesApi.create({
        name: catName,
        description: catDesc || undefined,
      }),
    onSuccess: (newCat) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      setNewCatId(newCat._id);
      setCatName("");
      setCatDesc("");
      setShowCatCreate(false);
      toast.success("Kategoriya qo'shildi");
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.error?.message || "Xatolik"),
  });

  const openEdit = (eq: Equipment) => {
    setEditingEq(eq);
    setEditName(eq.name);
    setEditDesc(eq.description || "");
    setEditRate(eq.dailyRate.toString());
    setEditQty(eq.totalQuantity.toString());
    setEditActive(eq.isActive);
    setShowEdit(true);
  };

  const openRental = (eq: { _id: string; name: string; availableQuantity: number; dailyRate: number }) => {
    setRentalEq({ id: eq._id, name: eq.name, maxQty: eq.availableQuantity, rate: eq.dailyRate });
    setRentalQty("1");
    setRentalClientId("");
    setRentalDeposit("");
    setRentalLocation(null);
    setRentalLocationLabel("");
    setShowRental(true);
  };

  const activeCategoryName =
    categories?.find((c) => c._id === categoryId)?.name || "Barchasi";

  return (
    <AppLayout>
      <div className="p-4 space-y-4 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold">Ombor</h2>
              <p className="text-xs text-muted-foreground">
                {activeCategoryName} — {equipment?.length ?? 0} ta
              </p>
            </div>
          </div>
          {isAdmin && (
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4" /> Yangi
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Yangi jihoz qo'shish</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Kategoriya</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs gap-1"
                        type="button"
                        onClick={() => setShowCatCreate(true)}
                      >
                        <FolderPlus className="h-3 w-3" />
                        Yangi
                      </Button>
                    </div>
                    <Select value={newCatId} onValueChange={setNewCatId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Kategoriyani tanlang" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.map((c) => (
                          <SelectItem key={c._id} value={c._id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Jihoz nomi</Label>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Masalan: Lesa A-seriya 2m"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Donasi</Label>
                      <Input
                        type="number"
                        min={1}
                        value={newQty}
                        onChange={(e) => setNewQty(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Kunlik narx (so'm)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={newRate}
                        onChange={(e) => setNewRate(e.target.value)}
                        placeholder="5000"
                      />
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    disabled={!newCatId || !newName || createEquipmentMutation.isPending}
                    onClick={() => createEquipmentMutation.mutate()}
                  >
                    {createEquipmentMutation.isPending ? "Saqlanmoqda..." : "Jihozni qo'shish"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Category tabs */}
        <Tabs defaultValue="all" onValueChange={(v) => setCategoryId(v === "all" ? undefined : v)}>
          <TabsList className="w-full flex-wrap h-auto">
            <TabsTrigger value="all" className="text-xs">Barchasi</TabsTrigger>
            {categories?.map((cat) => (
              <TabsTrigger key={cat._id} value={cat._id} className="text-xs">
                {cat.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Equipment Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {equipment?.map((eq) => (
              <Card key={eq._id} className="flex flex-col">
                <CardContent className="p-3 flex-1 flex flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{eq.name}</p>
                      <p className="text-xs text-muted-foreground">{eq.category.name}</p>
                    </div>
                    <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge
                      variant={eq.availableQuantity > 0 ? "default" : "destructive"}
                      className="text-[10px] px-1 py-0"
                    >
                      {eq.availableQuantity} dona
                    </Badge>
                    <span className="text-muted-foreground">{eq.rentedQuantity} ijarada</span>
                  </div>
                  <p className="text-xs font-medium">{formatCurrency(eq.dailyRate)}/kun</p>
                  <div className="flex gap-1.5 mt-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-7 text-xs gap-1"
                      disabled={eq.availableQuantity <= 0}
                      onClick={() => openRental(eq)}
                    >
                      <ShoppingCart className="h-3 w-3" />
                      Ijara
                    </Button>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 shrink-0"
                        onClick={() => openEdit(eq)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 shrink-0"
                      onClick={() => {
                        setHistoryEqId(eq._id);
                        setHistoryEqName(eq.name);
                        setShowHistory(true);
                      }}
                    >
                      <History className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Quick Rental Dialog */}
      <Dialog open={showRental} onOpenChange={setShowRental}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Ijaraga berish
            </DialogTitle>
          </DialogHeader>
          {rentalEq && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3">
                <p className="font-medium text-sm">{rentalEq.name}</p>
                <p className="text-xs text-muted-foreground">
                  Omborda: {rentalEq.maxQty} dona | {formatCurrency(rentalEq.rate)}/kun
                </p>
              </div>

              <div className="space-y-2">
                <Label>Mijoz</Label>
                <Input
                  placeholder="Ism yoki telefon bo'yicha qidirish..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="mb-1"
                />
                <Select value={rentalClientId} onValueChange={setRentalClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Mijozni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.data?.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.fullName} — {c.phone}
                      </SelectItem>
                    ))}
                    {(!clients?.data || clients.data.length === 0) && (
                      <div className="px-2 py-3 text-xs text-muted-foreground">
                        Mijoz topilmadi
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Nechta dona</Label>
                  <Input
                    type="number"
                    min={1}
                    max={rentalEq.maxQty}
                    value={rentalQty}
                    onChange={(e) => setRentalQty(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Maks: {rentalEq.maxQty} dona
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Boshlanish</Label>
                  <Input
                    type="datetime-local"
                    value={rentalStartDate}
                    onChange={(e) => setRentalStartDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Omonat (ixtiyoriy)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={rentalDeposit}
                  onChange={(e) => setRentalDeposit(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Yetkazish joyi (ixtiyoriy)
                </Label>
                <MapPicker
                  value={rentalLocation}
                  onChange={(loc) => setRentalLocation(loc)}
                  height={240}
                />
                <Input
                  type="text"
                  placeholder="Joy nomi (ixtiyoriy)"
                  value={rentalLocationLabel}
                  onChange={(e) => setRentalLocationLabel(e.target.value)}
                />
              </div>

              <Button
                className="w-full"
                disabled={!rentalClientId || !rentalQty || createRentalMutation.isPending}
                onClick={() => {
                  const qty = parseInt(rentalQty);
                  if (qty > rentalEq.maxQty) {
                    toast.error(`Maksimal ${rentalEq.maxQty} dona mavjud`);
                    return;
                  }
                  createRentalMutation.mutate();
                }}
              >
                {createRentalMutation.isPending ? "Ochilmoqda..." : "Arendani ochish"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Equipment Dialog */}
      <Dialog open={showEdit} onOpenChange={(o) => { setShowEdit(o); if (!o) setEditingEq(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              {editingEq?.name} — tahrirlash
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editingEq?.isActive && (
              <div className="rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive flex items-center gap-2">
                <EyeOff className="h-3.5 w-3.5 shrink-0" />
                Jihoz faol emas — arendalarda ko'rinmaydi
              </div>
            )}
            <div className="space-y-2">
              <Label>Jihoz nomi</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Masalan: Lesa A-seriya 2m"
              />
            </div>
            <div className="space-y-2">
              <Label>Tavsif (ixtiyoriy)</Label>
              <Input
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Qisqa tavsif"
              />
            </div>
            <div className="space-y-2">
              <Label>Kunlik narx (so'm)</Label>
              <Input
                type="number"
                min={0}
                value={editRate}
                onChange={(e) => setEditRate(e.target.value)}
                placeholder="5000"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Ombordagi donasi</Label>
                <span className="text-[10px] text-muted-foreground">
                  {editingEq?.rentedQuantity ?? 0} dona ijarada
                </span>
              </div>
              <Input
                type="number"
                min={1}
                value={editQty}
                onChange={(e) => setEditQty(e.target.value)}
              />
              {editingEq && parseInt(editQty) < editingEq.rentedQuantity && (
                <p className="text-[10px] text-destructive">
                  Ijaradagidan ({editingEq.rentedQuantity}) kam bo'lishi mumkin emas!
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={editActive ? "default" : "outline"}
                size="sm"
                className="flex-1 h-8 text-xs"
                type="button"
                onClick={() => setEditActive(true)}
              >
                Faol
              </Button>
              <Button
                variant={!editActive ? "destructive" : "outline"}
                size="sm"
                className="flex-1 h-8 text-xs"
                type="button"
                onClick={() => setEditActive(false)}
              >
                Faolsiz
              </Button>
            </div>
            <Separator />
            <Button
              className="w-full"
              disabled={!editName || updateEquipmentMutation.isPending || (!!editingEq && parseInt(editQty) < editingEq.rentedQuantity)}
              onClick={() => updateEquipmentMutation.mutate()}
            >
              {updateEquipmentMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              type="button"
              onClick={() => { setShowEdit(false); setShowAdjust(true); }}
            >
              Miqdorni sozlash (sabab bilan)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ombor miqdorini sozlash: sotib olindi / yaroqsiz / yo'qoldi */}
      <Dialog open={showAdjust} onOpenChange={(o) => { setShowAdjust(o); if (!o) setEditingEq(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ombor miqdorini sozlash</DialogTitle>
          </DialogHeader>
          {editingEq && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {editingEq.name} — omborda {editingEq.totalQuantity} dona
                ({editingEq.rentedQuantity} dona ijarada)
              </p>
              <div className="space-y-2">
                <Label>O'zgarish</Label>
                <Input
                  type="number"
                  placeholder="+5 yoki -2"
                  value={adjustValue}
                  onChange={(e) => setAdjustValue(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                  Musbat — yangi jihoz keldi, manfiy — yaroqsiz yoki yo'qolgan.
                  {adjustValue && !isNaN(parseInt(adjustValue)) && (
                    <> Yangi jami: {editingEq.totalQuantity + parseInt(adjustValue)} dona.</>
                  )}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Sabab</Label>
                <Input
                  placeholder="Masalan: 5 ta yangi lesa sotib olindi"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                disabled={
                  adjustQuantityMutation.isPending ||
                  !adjustValue ||
                  isNaN(parseInt(adjustValue)) ||
                  parseInt(adjustValue) === 0 ||
                  adjustReason.trim().length < 3 ||
                  editingEq.totalQuantity + parseInt(adjustValue) < editingEq.rentedQuantity
                }
                onClick={() => adjustQuantityMutation.mutate()}
              >
                {adjustQuantityMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
              </Button>
              {!!adjustValue &&
                !isNaN(parseInt(adjustValue)) &&
                editingEq.totalQuantity + parseInt(adjustValue) < editingEq.rentedQuantity && (
                  <p className="text-[10px] text-destructive">
                    Ijaradagi {editingEq.rentedQuantity} donadan kam bo'lishi mumkin emas
                  </p>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Equipment History Dialog */}
      <Dialog open={showHistory} onOpenChange={(o) => { setShowHistory(o); if (!o) setHistoryEqId(null); }}>
        <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              {historyEqName} — harakatlar tarixi
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {historyLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
              </div>
            ) : historyData && historyData.length > 0 ? (
              historyData.map((entry) => (
                <Card key={entry._id} className="cursor-pointer" onClick={() => router.push(`/rentals/${entry._id}`)}>
                  <CardContent className="p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{entry.rentalNumber}</p>
                      <Badge variant={entry.status === "active" ? "default" : "secondary"} className="text-[10px]">
                        {entry.status === "active" ? "Faol" : "Yopilgan"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>{entry.client.fullName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(entry.startDate)}</span>
                      {entry.endDate && (
                        <>
                          <ArrowRight className="h-3 w-3" />
                          <span>{formatDate(entry.endDate)}</span>
                        </>
                      )}
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between text-xs">
                      <span>
                        {entry.quantity} dona × {formatCurrency(entry.dailyRate)}/kun
                      </span>
                      <span className="flex items-center gap-1">
                        {entry.activeQuantity > 0 ? (
                          <>
                            <XCircle className="h-3 w-3 text-destructive" />
                            <span className="text-destructive">{entry.activeQuantity} qaytarilmagan</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                            <span className="text-green-500">To'liq qaytarilgan</span>
                          </>
                        )}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Hali hech qanday harakat yo'q</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Category Create Dialog */}
      <Dialog open={showCatCreate} onOpenChange={setShowCatCreate}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Yangi kategoriya</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Kategoriya nomi</Label>
              <Input
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="Masalan: Lesa"
              />
            </div>
            <div className="space-y-2">
              <Label>Tavsif (ixtiyoriy)</Label>
              <Input
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                placeholder="Qurilish lesalari"
              />
            </div>
            <Button
              className="w-full"
              disabled={!catName || createCategoryMutation.isPending}
              onClick={() => createCategoryMutation.mutate()}
            >
              {createCategoryMutation.isPending ? "Saqlanmoqda..." : "Kategoriya yaratish"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
