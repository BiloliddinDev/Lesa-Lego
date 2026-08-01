"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { rentalsApi, paymentsApi } from "@/lib/api";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, Download, DollarSign, Undo2, XCircle, CheckCircle2, AlertTriangle, FileText, MapPin, CalendarDays } from "lucide-react";
import dynamic from "next/dynamic";

// Leaflet faqat browserda ishlaydi — SSR o'chirilgan holda yuklaymiz
const MapView = dynamic(() => import("@/components/ui/map-view"), {
  ssr: false,
  loading: () => (
    <div className="h-[220px] rounded-lg border flex items-center justify-center text-sm text-muted-foreground">
      Xarita yuklanmoqda...
    </div>
  ),
});
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  active: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  overdue: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

const statusLabels: Record<string, string> = {
  active: "Faol",
  overdue: "Muddati o'tgan",
  completed: "Yopilgan",
};

export default function RentalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Dialoglar
  const [showReturn, setShowReturn] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showPdf, setShowPdf] = useState(false);

  // Qaytarish state
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 16));
  const [returnResult, setReturnResult] = useState<any>(null);

  // To'lov state
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payNote, setPayNote] = useState("");

  // Yopish state
  const [closeNote, setCloseNote] = useState("");
  const [closeResult, setCloseResult] = useState<any>(null);
  const [closeLoading, setCloseLoading] = useState(false);

  // PDF type
  const [pdfType, setPdfType] = useState("nakladnoy");
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);

  // PDF ni auth token bilan yuklab olish (window.open token yubormaydi → 401)
  const downloadPdf = async (type: string) => {
    try {
      setPdfLoading(type);
      const blob = await rentalsApi.getPdf(id, type);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${rental?.rentalNumber || id}-${type}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Yuklab olish boshlanishi uchun kichik kechikish bilan revoke qilamiz
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setShowPdf(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || "PDF yuklab olishda xatolik");
    } finally {
      setPdfLoading(null);
    }
  };

  // Ma'lumotlar
  const { data: rental, isLoading } = useQuery({
    queryKey: ["rental", id],
    queryFn: () => rentalsApi.getById(id),
  });

  const { data: check } = useQuery({
    queryKey: ["rental", id, "check"],
    queryFn: () => rentalsApi.getCheck(id),
    enabled: !!rental && rental.status !== "completed",
  });

  const isActive = rental?.status === "active" || rental?.status === "overdue";
  const allReturned = rental?.items.every((i) => i.returnedQuantity === i.quantity);

  // Qaytarish mutation
  const returnMutation = useMutation({
    mutationFn: () =>
      rentalsApi.returnItems(id, {
        returns: Object.entries(returnQty)
          .filter(([, qty]) => qty > 0)
          .map(([eqId, qty]) => ({ equipmentId: eqId, quantity: qty })),
        returnDate,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["rental", id] });
      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      setReturnResult(result);
      toast.success("Jihozlar qaytarildi");
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.error?.message || "Xatolik"),
  });

  // To'lov mutation
  const paymentMutation = useMutation({
    mutationFn: () =>
      paymentsApi.create({
        rentalId: id,
        amount: parseInt(payAmount),
        method: payMethod,
        note: payNote || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rental", id] });
      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast.success("To'lov qo'shildi");
      setShowPayment(false);
      setPayAmount("");
      setPayNote("");
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.error?.message || "Xatolik"),
  });

  // Yopish handler
  const handleClose = async () => {
    if (!allReturned) {
      toast.error("Hali qaytarilmagan jihozlar bor! Avval barchasini qaytaring.");
      return;
    }
    setCloseLoading(true);
    try {
      const result = await rentalsApi.close(id, { note: closeNote || undefined });
      setCloseResult(result);
      queryClient.invalidateQueries({ queryKey: ["rental", id] });
      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      toast.success("Arenda yopildi");
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || "Xatolik");
    } finally {
      setCloseLoading(false);
    }
  };

  const initReturn = () => {
    const init: Record<string, number> = {};
    rental?.items.forEach((item) => {
      init[item.equipment] = 0;
    });
    setReturnQty(init);
    setReturnResult(null);
    setReturnDate(new Date().toISOString().slice(0, 16));
    setShowReturn(true);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-4 space-y-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </AppLayout>
    );
  }

  if (!rental) {
    return (
      <AppLayout>
        <div className="p-4 text-center text-muted-foreground">Arenda topilmadi</div>
      </AppLayout>
    );
  }

  const openItems = rental.items.filter((i) => i.quantity > i.returnedQuantity);

  return (
    <AppLayout>
      <div className="p-4 space-y-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{rental.rentalNumber}</h2>
              <Badge className={statusColors[rental.status]}>
                {statusLabels[rental.status]}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {rental.createdBy.name} tomonidan yaratilgan
            </p>
          </div>
        </div>

        {/* Client info */}
        <Card>
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="font-medium">{rental.client.fullName}</p>
              <p className="text-sm text-muted-foreground">{rental.client.phone}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => router.push(`/clients/${rental.client._id}`)}
            >
              Mijoz sahifasi
            </Button>
          </CardContent>
        </Card>

        {/* Yetkazish joyi (xarita) */}
        {rental.deliveryLocation?.lat !== undefined && rental.deliveryLocation?.lng !== undefined && (
          <Card>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Yetkazish joyi
                  </p>
                  <p className="text-sm font-medium break-words">
                    {rental.deliveryLocation.label ||
                      `${rental.deliveryLocation.lat.toFixed(5)}, ${rental.deliveryLocation.lng.toFixed(5)}`}
                  </p>
                </div>
              </div>
              <MapView lat={rental.deliveryLocation.lat} lng={rental.deliveryLocation.lng} />
            </CardContent>
          </Card>
        )}

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Boshlanish
              </p>
              <p className="text-sm font-medium">{formatDate(rental.startDate)}</p>
            </CardContent>
          </Card>
          {rental.expectedEndDate ? (
            <Card>
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Kutilgan tugash
                </p>
                <p className="text-sm font-medium">{formatDate(rental.expectedEndDate)}</p>
              </CardContent>
            </Card>
          ) : rental.endDate ? (
            <Card>
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Yopilgan
                </p>
                <p className="text-sm font-medium">{formatDate(rental.endDate)}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Items */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" /> Jihozlar ({rental.items.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {rental.items.map((item, idx) => {
              const activeQty = item.quantity - item.returnedQuantity;
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between border-b pb-2 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.equipmentName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(item.dailyRate)}/kun
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-sm font-medium">{item.quantity} dona</p>
                    {activeQty > 0 ? (
                      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                        {activeQty} faol
                      </Badge>
                    ) : (
                      <p className="text-[10px] text-green-600">To'liq qaytarilgan</p>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Check / Amount */}
        {check && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Joriy hisob
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Jami</span>
                <span className="font-medium">{formatCurrency(check.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Omonat</span>
                <span>{formatCurrency(check.depositAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">To'langan</span>
                <span>{formatCurrency(check.paidAmount)}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm font-medium">Qarz</span>
                <span
                  className={`font-bold ${
                    check.debt > 0
                      ? "text-destructive"
                      : check.debt < 0
                        ? "text-green-600"
                        : ""
                  }`}
                >
                  {check.debt > 0
                    ? formatCurrency(check.debt)
                    : check.debt < 0
                      ? `Ortiqcha: ${formatCurrency(Math.abs(check.debt))}`
                      : "0 so'm"}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Kunlik hisob-kitob jadvali */}
        {check?.dailySchedule && check.dailySchedule.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarDays className="h-4 w-4" /> Kunlik hisob-kitob
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0.5">
              <div className="grid grid-cols-[2.5rem_1fr_auto_auto] gap-2 px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground border-b">
                <span>Kun</span>
                <span>Sana</span>
                <span className="text-right">Kunlik</span>
                <span className="text-right">Jami</span>
              </div>
              <div className="max-h-56 overflow-y-auto">
                {check.dailySchedule.map((day) => {
                  const isLast = day.dayNumber === check.dailySchedule.length;
                  return (
                    <div
                      key={day.dayNumber}
                      className={`grid grid-cols-[2.5rem_1fr_auto_auto] gap-2 px-2 py-1.5 text-sm items-center ${
                        isLast ? "bg-primary/5 rounded-md font-medium" : ""
                      }`}
                    >
                      <span className="text-xs text-muted-foreground">#{day.dayNumber}</span>
                      <span className="text-xs">{formatDate(day.date)}</span>
                      <span className="text-right text-xs text-muted-foreground">
                        {formatCurrency(day.dailyAmount)}
                      </span>
                      <span className="text-right text-sm">
                        {formatCurrency(day.cumulativeAmount)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <Separator className="my-1" />
              <div className="flex items-center justify-between px-2 pt-1 text-xs text-muted-foreground">
                <span>
                  {check.dailySchedule.length} kunlik hisob — har kuni qo&apos;shilib boradi
                </span>
                <span className="font-semibold text-foreground">
                  Jami: {formatCurrency(check.dailySchedule[check.dailySchedule.length - 1].cumulativeAmount)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          {isActive && (
            <>
              {/* Qaytarish Dialog */}
              <Dialog open={showReturn} onOpenChange={(o) => { setShowReturn(o); if (!o) setReturnResult(null); }}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={initReturn}
                    disabled={openItems.length === 0}
                  >
                    <Undo2 className="h-4 w-4" /> Qaytarish
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Undo2 className="h-4 w-4" />
                      {returnResult ? "Qaytarildi" : "Jihoz qaytarish"}
                    </DialogTitle>
                  </DialogHeader>

                  {returnResult ? (
                    <div className="space-y-3">
                      <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-center">
                        <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-1" />
                        <p className="text-sm font-medium text-green-700 dark:text-green-300">
                          Jihozlar muvaffaqiyatli qaytarildi!
                        </p>
                      </div>
                      {/* Show updated check */}
                      {returnResult.check && (
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Jami</span>
                            <span>{formatCurrency(returnResult.check.totalAmount)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Qarz</span>
                            <span className={returnResult.check.debt > 0 ? "text-destructive font-medium" : "text-green-600 font-medium"}>
                              {formatCurrency(returnResult.check.debt)}
                            </span>
                          </div>
                        </div>
                      )}
                      <Button className="w-full" onClick={() => setShowReturn(false)}>
                        Yopish
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Sana</Label>
                        <Input
                          type="datetime-local"
                          value={returnDate}
                          onChange={(e) => setReturnDate(e.target.value)}
                        />
                      </div>
                      {openItems.map((item) => {
                        const maxQty = item.quantity - item.returnedQuantity;
                        return (
                          <div
                            key={item.equipment}
                            className="rounded-lg border p-2.5 space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{item.equipmentName}</span>
                              <Badge variant="outline" className="text-[10px]">
                                {maxQty} dona
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={0}
                                max={maxQty}
                                className="w-20 h-8 text-center"
                                placeholder="0"
                                value={returnQty[item.equipment] || ""}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  setReturnQty({ ...returnQty, [item.equipment]: Math.min(val, maxQty) });
                                }}
                              />
                              <span className="text-xs text-muted-foreground">
                                / {maxQty} dona
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      <Button
                        className="w-full"
                        disabled={
                          returnMutation.isPending ||
                          Object.values(returnQty).every((q) => q <= 0)
                        }
                        onClick={() => returnMutation.mutate()}
                      >
                        {returnMutation.isPending
                          ? "Qaytarilmoqda..."
                          : "Qaytarish"}
                      </Button>
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              {/* To'lov Dialog */}
              <Dialog
                open={showPayment}
                onOpenChange={(o) => {
                  setShowPayment(o);
                  if (o && check) {
                    setPayAmount(check.debt > 0 ? check.debt.toString() : "");
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5">
                    <DollarSign className="h-4 w-4" /> To'lov
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" /> Yangi to'lov
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {check && (
                      <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Jami qarz</span>
                          <span className={check.debt > 0 ? "text-destructive font-medium" : "text-green-600"}>
                            {formatCurrency(check.debt)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">To'langan</span>
                          <span>{formatCurrency(check.paidAmount)}</span>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Summa</Label>
                      <Input
                        type="number"
                        min={1}
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        placeholder={check?.debt ? check.debt.toString() : "Summani kiriting"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>To'lov usuli</Label>
                      <Select value={payMethod} onValueChange={setPayMethod}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Naqd</SelectItem>
                          <SelectItem value="card">Karta</SelectItem>
                          <SelectItem value="transfer">O'tkazma</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Eslatma (ixtiyoriy)</Label>
                      <Input
                        value={payNote}
                        onChange={(e) => setPayNote(e.target.value)}
                        placeholder="To'lov haqida..."
                      />
                    </div>
                    <Button
                      className="w-full"
                      disabled={!payAmount || paymentMutation.isPending}
                      onClick={() => paymentMutation.mutate()}
                    >
                      {paymentMutation.isPending
                        ? "Kutilmoqda..."
                        : "To'lov qilish"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Yopish Dialog */}
              <Dialog
                open={showClose}
                onOpenChange={(o) => {
                  setShowClose(o);
                  if (!o) setCloseResult(null);
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      if (!allReturned) {
                        toast.error("Hali qaytarilmagan jihozlar bor! Avval barchasini qaytaring.");
                        return;
                      }
                      setCloseNote("");
                      setCloseResult(null);
                      setShowClose(true);
                    }}
                  >
                    <XCircle className="h-4 w-4" /> Yopish
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      {closeResult ? "Arenda yopildi" : "Arendani yopish"}
                    </DialogTitle>
                  </DialogHeader>

                  {closeResult ? (
                    <div className="space-y-3">
                      <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-center">
                        <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-1" />
                        <p className="text-sm font-medium text-green-700 dark:text-green-300">
                          Arenda muvaffaqiyatli yopildi!
                        </p>
                      </div>
                      {closeResult.finalCheck && (
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Jami</span>
                            <span className="font-medium">{formatCurrency(closeResult.finalCheck.totalAmount)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">To'langan</span>
                            <span>{formatCurrency(closeResult.finalCheck.paidAmount)}</span>
                          </div>
                          <Separator />
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Yakuniy qarz</span>
                            <span className={closeResult.finalCheck.debt > 0 ? "text-destructive font-medium" : "text-green-600 font-medium"}>
                              {formatCurrency(closeResult.finalCheck.debt)}
                            </span>
                          </div>
                        </div>
                      )}
                      <Button className="w-full" onClick={() => setShowClose(false)}>
                        Yopish
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {check && (
                        <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Jami</span>
                            <span>{formatCurrency(check.totalAmount)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">To'langan</span>
                            <span>{formatCurrency(check.paidAmount)}</span>
                          </div>
                          <Separator />
                          <div className="flex justify-between font-medium">
                            <span>Qarz</span>
                            <span className={check.debt > 0 ? "text-destructive" : "text-green-600"}>
                              {formatCurrency(check.debt)}
                            </span>
                          </div>
                        </div>
                      )}
                      {check && check.debt > 0 && (
                        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-2.5 flex items-start gap-2 text-xs">
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          <span className="text-amber-700 dark:text-amber-300">
                            Qarzdorlik mavjud. Yopishdan oldin to'lov qabul qilish tavsiya etiladi.
                          </span>
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>Eslatma (ixtiyoriy)</Label>
                        <Textarea
                          value={closeNote}
                          onChange={(e) => setCloseNote(e.target.value)}
                          placeholder="Arenda yopilishi haqida eslatma..."
                          rows={2}
                        />
                      </div>
                      <Button
                        className="w-full"
                        variant={check?.debt && check.debt > 0 ? "destructive" : "default"}
                        disabled={closeLoading}
                        onClick={handleClose}
                      >
                        {closeLoading ? "Yopilmoqda..." : "Arendani yopish"}
                      </Button>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </>
          )}

          {/* PDF Dialog */}
          <Dialog open={showPdf} onOpenChange={setShowPdf}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="h-4 w-4" /> PDF
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xs">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Download className="h-4 w-4" /> PDF yuklab olish
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                {[
                  { value: "nakladnoy", label: "Nakladnoy", desc: "Asosiy hujjat" },
                  { value: "check", label: "Check", desc: "Joriy hisob-kitob" },
                  { value: "contract", label: "Shartnoma", desc: "Ijara shartnomasi" },
                ].map((opt) => (
                  <Button
                    key={opt.value}
                    variant={pdfType === opt.value ? "default" : "outline"}
                    className="w-full justify-between h-auto py-2.5"
                    disabled={pdfLoading === opt.value}
                    onClick={() => {
                      setPdfType(opt.value);
                      downloadPdf(opt.value);
                    }}
                  >
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-medium">{opt.label}</span>
                      <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                    </div>
                    <Download className="h-4 w-4 shrink-0" />
                  </Button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Note */}
        {rental.note && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Eslatma</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{rental.note}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
