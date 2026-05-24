'use client';

import { useState } from 'react';
import { ProductCard } from './product-card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  weight: number;
  size: string;
  volumeCubicFt: number;
  category: string;
  isCritical: boolean;
}

interface ProductGridProps {
  products: Product[];
  categories: string[];
  onProductSelect?: (product: Product) => void;
  selectedProducts?: string[];
}

export function ProductGrid({ products = [], categories = [], onProductSelect, selectedProducts = [] }: ProductGridProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [criticalFilter, setCriticalFilter] = useState<string>('all');

  console.log('ProductGrid received:', { products, categories, productsLength: products.length });

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.description?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const matchesCritical = criticalFilter === 'all' ||
      (criticalFilter === 'critical' && product.isCritical) ||
      (criticalFilter === 'non-critical' && !product.isCritical);

    return matchesSearch && matchesCategory && matchesCritical;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={criticalFilter} onValueChange={setCriticalFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Items</SelectItem>
            <SelectItem value="critical">Critical Only</SelectItem>
            <SelectItem value="non-critical">Non-Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-600">
        Showing {filteredProducts.length} of {products.length} products
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onSelect={onProductSelect}
            selected={selectedProducts.includes(product.id)}
          />
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No products found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}
