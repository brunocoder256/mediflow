"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
    Plus, Search, MoreHorizontal, Edit, Trash2, Eye,
} from "lucide-react";

interface Product {
    id: string;
    name: string;
    sku: string;
    barcode: string;
    category: string;
    stock: number;
    status: "active" | "inactive";
    price: number;
}

export default function ProductsPage() {
    const [loading, setLoading] = React.useState(true);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [products, setProducts] = React.useState<Product[]>([]);
    const [showAdd, setShowAdd] = React.useState(false);
    const [categories, setCategories] = React.useState<any[]>([]);
    const [units, setUnits] = React.useState<any[]>([]);
    const [form, setForm] = React.useState({ name: "", sku: "", barcode: "", category_id: "", unit_id: "", reorder_level: 10, description: "", generic_name: "", brand_name: "" });
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
        fetchProducts();
        // load categories/units for the Add dialog (direct Supabase, no dedicated API)
        (async () => {
            try {
                const { createBrowserClient } = await import("@/lib/supabase/client");
                const sb = createBrowserClient();
                const [{ data: cats }, { data: uns }] = await Promise.all([
                    sb.from("categories").select("id, name").eq("is_active", true).order("name"),
                    sb.from("units").select("id, name, abbreviation").order("name"),
                ]);
                if (cats) setCategories(cats);
                if (uns) setUnits(uns);
            } catch {}
        })();
    }, []);

    async function fetchProducts() {
        try {
            const res = await fetch("/api/products");
            const data = await res.json();
            setProducts(Array.isArray(data) ? data : (data.data ?? []));
        } catch {
            setProducts([]);
        } finally {
            setLoading(false);
        }
    }

    async function submitAdd() {
        if (!form.name.trim()) return alert("Name is required");
        setSaving(true);
        try {
            const res = await fetch("/api/products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.name.trim(),
                    sku: form.sku.trim(),
                    barcode: form.barcode.trim(),
                    category_id: form.category_id || undefined,
                    unit_id: form.unit_id || undefined,
                    reorder_level: Number(form.reorder_level) || 10,
                    description: form.description.trim(),
                    generic_name: form.generic_name.trim(),
                    brand_name: form.brand_name.trim(),
                }),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || "Failed to create product");
            setShowAdd(false);
            setForm({ name: "", sku: "", barcode: "", category_id: "", unit_id: "", reorder_level: 10, description: "", generic_name: "", brand_name: "" });
            fetchProducts();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setSaving(false);
        }
    }

    const filteredProducts = products.filter((product) => {
        const matchesSearch =
            product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
            product.barcode.includes(searchQuery);
        return matchesSearch;
    });

    const filterCategories = [...new Set(products.map((p) => p.category))];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Products</h1>
                    <p className="text-muted-foreground">
                        Manage your product catalog and inventory
                    </p>
                </div>
                <Button onClick={() => setShowAdd(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product
                </Button>
            </div>

            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col gap-4 md:flex-row">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search products..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select className="w-full md:w-[180px]" value="all" onChange={() => {}}>
                            <option value="all">All Categories</option>
                            {filterCategories.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </Select>
                        <Select className="w-full md:w-[150px]" value="all" onChange={() => {}}>
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-6 space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="flex items-center gap-4">
                                    <Skeleton className="h-12 w-12" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-48" />
                                        <Skeleton className="h-3 w-32" />
                                    </div>
                                    <Skeleton className="h-8 w-20" />
                                </div>
                            ))}
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <p className="text-muted-foreground">No products found</p>
                            <Button variant="link" className="mt-2" onClick={() => setShowAdd(true)}>
                                Add your first product
                            </Button>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>SKU</TableHead>
                                    <TableHead className="hidden md:table-cell">Barcode</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead className="text-right">Stock</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredProducts.map((product) => (
                                    <TableRow key={product.id}>
                                        <TableCell className="font-medium">{product.name}</TableCell>
                                        <TableCell className="text-muted-foreground">{product.sku}</TableCell>
                                        <TableCell className="hidden md:table-cell text-muted-foreground">
                                            {product.barcode}
                                        </TableCell>
                                        <TableCell>{product.category}</TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant={product.stock < 10 ? "destructive" : "secondary"}>
                                                {product.stock}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={product.status === "active" ? "success" : "secondary"}>
                                                {product.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {!loading && filteredProducts.length > 0 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        Showing {filteredProducts.length} of {products.length} products
                    </p>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" disabled>Previous</Button>
                        <Button variant="outline" size="sm" disabled>Next</Button>
                    </div>
                </div>
            )}

            <Dialog open={showAdd} onOpenChange={setShowAdd}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-card">
                    <DialogHeader>
                        <DialogTitle>Add Product</DialogTitle>
                        <DialogDescription>Creates a new product in your organization. SKU/barcode optional.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Paracetamol 500mg" /></div>
                        <div className="grid gap-3 md:grid-cols-2">
                            <div><Label>SKU</Label><Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="PAR-500" /></div>
                            <div><Label>Barcode</Label><Input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} placeholder="123456789" /></div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            <div><Label>Generic Name</Label><Input value={form.generic_name} onChange={e => setForm({ ...form, generic_name: e.target.value })} placeholder="Paracetamol" /></div>
                            <div><Label>Brand Name</Label><Input value={form.brand_name} onChange={e => setForm({ ...form, brand_name: e.target.value })} placeholder="Panadol" /></div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            <div><Label>Category</Label><Select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}><option value="">No category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
                            <div><Label>Unit</Label><Select value={form.unit_id} onChange={e => setForm({ ...form, unit_id: e.target.value })}><option value="">No unit</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}{u.abbreviation ? ` (${u.abbreviation})` : ""}</option>)}</Select></div>
                        </div>
                        <div><Label>Reorder Level</Label><Input type="number" min={0} value={form.reorder_level} onChange={e => setForm({ ...form, reorder_level: Number(e.target.value) })} /></div>
                        <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Short description" /></div>
                        <Button onClick={submitAdd} disabled={saving || !form.name.trim()} className="w-full">{saving ? "Saving..." : "Create Product"}</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}