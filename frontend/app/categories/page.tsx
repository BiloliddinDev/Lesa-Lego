"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { categoriesApi } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function CategoriesPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [order, setOrder] = useState("");

  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: categoriesApi.getAll,
  });

  const resetForm = () => { setName(""); setDescription(""); setOrder(""); setEditId(null); };

  const createMutation = useMutation({
    mutationFn: () => categoriesApi.create({ name, description: description || undefined, order: order ? parseInt(order) : undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Kategoriya qo'shildi");
      setShowCreate(false);
      resetForm();
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || "Xatolik"),
  });

  const updateMutation = useMutation({
    mutationFn: () => categoriesApi.update(editId!, { name, description: description || undefined, order: order ? parseInt(order) : undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Kategoriya yangilandi");
      setEditId(null);
      resetForm();
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || "Xatolik"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoriesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Kategoriya o'chirildi");
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

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Kategoriyalar</h2>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4" /> Yangi</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Yangi kategoriya</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2"><Label>Nomi</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-2"><Label>Tavsif</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                <div className="space-y-2"><Label>Tartib</Label><Input type="number" value={order} onChange={(e) => setOrder(e.target.value)} /></div>
                <Button className="w-full" onClick={() => createMutation.mutate()}>Qo'shish</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-2">
            {categories?.map((cat) => (
              <Card key={cat._id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{cat.name}</p>
                    <p className="text-xs text-muted-foreground">{cat.description || "—"}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                      setEditId(cat._id);
                      setName(cat.name);
                      setDescription(cat.description || "");
                      setOrder(String(cat.order));
                    }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(cat._id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editId} onOpenChange={(o) => !o && resetForm()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Kategoriyani tahrirlash</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2"><Label>Nomi</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Tavsif</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="space-y-2"><Label>Tartib</Label><Input type="number" value={order} onChange={(e) => setOrder(e.target.value)} /></div>
            <Button className="w-full" onClick={() => updateMutation.mutate()}>Saqlash</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
