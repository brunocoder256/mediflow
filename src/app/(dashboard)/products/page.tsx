"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select } from "@/components/ui/select";
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

    React.useEffect(() => {
        fetchProducts();
    }, []);

    async function fetchProducts() {
        try {
            const res = await fetch("/api/products");
            const data = await res.json();
            setProducts(data);
        } catch {
            setProducts([]);
        } finally {
            setLoading(false);
        }
    }

    const filteredProducts = products.filter((product) => {
        const matchesSearch =
            product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
            product.barcode.includes(searchQuery);
        return matchesSearch;
    });

    const categories = [...new Set(products.map((p) => p.category))];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Products</h1>
                    <p className="text-muted-foreground">
                        Manage your product catalog and inventory
                    </p>
                </div>
                <Button>
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
                            {categories.map((cat) => (
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
                            <Button variant="link" className="mt-2">
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
        </div>
    );
}