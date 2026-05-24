'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProductGrid } from '@/components/products/product-grid';
import { Plus, Minus, Package as PackageIcon, Loader2 } from 'lucide-react';

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

interface PackageItem {
  productId: string;
  product: Product;
  quantity: number;
}

export function PackageCreationForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<PackageItem[]>([]);
  const [step, setStep] = useState(1); // 1: Select Products, 2: Package Details

  // Form fields
  const [packageName, setPackageName] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      console.log('Products API response:', data);
      setProducts(data.products || []);
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
      setCategories([]);
    }
  };

  const handleProductSelect = (product: Product) => {
    const existingItem = selectedItems.find(item => item.productId === product.id);
    if (existingItem) {
      setSelectedItems(selectedItems.filter(item => item.productId !== product.id));
    } else {
      setSelectedItems([...selectedItems, { productId: product.id, product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setSelectedItems(selectedItems.map(item => {
      if (item.productId === productId) {
        const newQuantity = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const removeItem = (productId: string) => {
    setSelectedItems(selectedItems.filter(item => item.productId !== productId));
  };

  const calculateTotals = () => {
    let totalWeight = 0;
    let totalVolume = 0;
    let isCritical = false;

    selectedItems.forEach(item => {
      totalWeight += item.product.weight * item.quantity;
      totalVolume += item.product.volumeCubicFt * item.quantity;
      if (item.product.isCritical) isCritical = true;
    });

    return { totalWeight, totalVolume, isCritical };
  };

  const handleCreatePackage = async () => {
    if (!packageName || selectedItems.length === 0) {
      alert('Please enter package name and add at least one item');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageName,
          notes,
          items: selectedItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity
          }))
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        // Redirect to delivery path optimization page
        router.push(`/packages/${data.package.id}/optimize`);
      } else {
        alert(data.error || 'Failed to create package');
      }
    } catch (error) {
      console.error('Error creating package:', error);
      alert('Failed to create package');
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-4">
        <div className={`flex items-center gap-2 ${step === 1 ? 'text-primary' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 1 ? 'bg-primary text-white' : 'bg-gray-200'}`}>
            1
          </div>
          <span className="font-medium">Select Products</span>
        </div>
        <div className="w-16 h-0.5 bg-gray-300" />
        <div className={`flex items-center gap-2 ${step === 2 ? 'text-primary' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 2 ? 'bg-primary text-white' : 'bg-gray-200'}`}>
            2
          </div>
          <span className="font-medium">Package Details</span>
        </div>
      </div>

      {step === 1 ? (
        <>
          {/* Selected Items Summary */}
          {selectedItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PackageIcon className="h-5 w-5" />
                  Selected Items ({selectedItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {selectedItems.map(item => (
                    <div key={item.productId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.product.name}</p>
                        <p className="text-xs text-gray-500">
                          {item.product.weight} kg × {item.quantity} = {item.product.weight * item.quantity} kg
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity(item.productId, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity(item.productId, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removeItem(item.productId)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Total Weight:</span>
                    <span className="font-semibold">{totals.totalWeight.toFixed(2)} kg</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Total Volume:</span>
                    <span className="font-semibold">{totals.totalVolume.toFixed(2)} cu ft</span>
                  </div>
                  {totals.isCritical && (
                    <Badge variant="destructive">Contains Critical Items</Badge>
                  )}
                </div>
                <Button
                  className="w-full mt-4"
                  onClick={() => setStep(2)}
                  disabled={selectedItems.length === 0}
                >
                  Continue to Package Details
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Product Selection */}
          <ProductGrid
            products={products}
            categories={categories}
            onProductSelect={handleProductSelect}
            selectedProducts={selectedItems.map(item => item.productId)}
          />
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Package Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Package Name */}
            <div>
              <Label>Package Name *</Label>
              <Input
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                placeholder="e.g., Order #1234"
              />
            </div>

            {/* Notes */}
            <div>
              <Label>Notes (Optional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special delivery instructions..."
              />
            </div>

            {/* Package Summary */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
              <h4 className="font-semibold text-blue-900">Package Summary</h4>
              
              {/* Items List */}
              <div className="space-y-2">
                {selectedItems.map(item => (
                  <div key={item.productId} className="flex justify-between text-sm bg-white p-2 rounded">
                    <span className="text-gray-700">{item.product.name}</span>
                    <span className="font-medium text-gray-900">x{item.quantity}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="pt-3 border-t border-blue-200 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">Total Items:</span>
                  <span className="font-semibold text-gray-900">{selectedItems.reduce((sum, item) => sum + item.quantity, 0)} items</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">Total Weight:</span>
                  <span className="font-semibold text-gray-900">{totals.totalWeight.toFixed(2)} kg</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">Total Volume:</span>
                  <span className="font-semibold text-gray-900">{totals.totalVolume.toFixed(2)} cu ft</span>
                </div>
                {totals.isCritical && (
                  <Badge variant="destructive" className="mt-2">⚠️ Critical Package</Badge>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                ← Back to Products
              </Button>
              <Button
                onClick={handleCreatePackage}
                disabled={loading || !packageName}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Find Best Delivery Path →'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
