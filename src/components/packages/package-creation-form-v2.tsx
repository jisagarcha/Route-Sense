'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ProductGrid } from '@/components/products/product-grid';
import { Plus, Minus, Package as PackageIcon, Loader2, MapPin, Route as RouteIcon } from 'lucide-react';

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
  deliveryLat?: number;
  deliveryLong?: number;
}

interface PackageItem {
  productId: string;
  product: Product;
  quantity: number;
  deliveryLat: number;
  deliveryLong: number;
  deliveryAddress: string;
}

export function PackageCreationFormV2() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [productsLoading, setProductsLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<PackageItem[]>([]);
  const [step, setStep] = useState(1); // 1: Select Products, 2: Package Details, 3: Delivery Route
  const [error, setError] = useState('');

  // Form fields
  const [packageName, setPackageName] = useState('');
  const [notes, setNotes] = useState('');
  const [warehouseLat, setWarehouseLat] = useState('27.7172');
  const [warehouseLong, setWarehouseLong] = useState('85.3120');
  
  // Route optimization result
  const [optimizedRoute, setOptimizedRoute] = useState<{
    totalDistance: number;
    estimatedDuration: number;
    algorithm: string;
    orderedItems: PackageItem[];
  } | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setProductsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/products');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch products');
      }

      setProducts(data.products || []);
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch products');
      setProducts([]);
      setCategories([]);
    } finally {
      setProductsLoading(false);
    }
  };

  const handleProductSelect = (product: Product) => {
    setSelectedItems((currentItems) => {
      const existingItem = currentItems.find(item => item.productId === product.id);
      if (existingItem) {
        return currentItems.filter(item => item.productId !== product.id);
      }

      return [...currentItems, {
        productId: product.id,
        product,
        quantity: 1,
        deliveryLat: product.deliveryLat ?? 27.7172,
        deliveryLong: product.deliveryLong ?? 85.3120,
        deliveryAddress: `Location for ${product.name}`
      }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setSelectedItems((currentItems) => currentItems.map(item => {
      if (item.productId === productId) {
        const newQuantity = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const removeItem = (productId: string) => {
    setSelectedItems((currentItems) => currentItems.filter(item => item.productId !== productId));
  };

  const updateItemLocation = (productId: string, field: 'deliveryLat' | 'deliveryLong' | 'deliveryAddress', value: string) => {
    setSelectedItems((currentItems) => currentItems.map(item => {
      if (item.productId === productId) {
        if (field === 'deliveryAddress') {
          return { ...item, [field]: value };
        } else {
          return { ...item, [field]: value === '' ? Number.NaN : Number(value) };
        }
      }
      return item;
    }));
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

  const handleOptimizeRoute = async () => {
    setError('');

    if (!packageName.trim()) {
      setError('Package name is required');
      return;
    }

    const startLat = Number(warehouseLat);
    const startLong = Number(warehouseLong);
    const hasInvalidCoordinate =
      !Number.isFinite(startLat) ||
      !Number.isFinite(startLong) ||
      selectedItems.some((item) =>
        !Number.isFinite(item.deliveryLat) ||
        !Number.isFinite(item.deliveryLong) ||
        !item.deliveryAddress.trim()
      );

    if (hasInvalidCoordinate) {
      setError('Enter valid warehouse coordinates and delivery details for every stop');
      return;
    }

    setOptimizing(true);
    try {
      const res = await fetch('/api/optimize-multi-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseLat: startLat,
          warehouseLong: startLong,
          algorithm: 'nearest-neighbor',
          stops: selectedItems.map(item => ({
            productId: item.productId,
            lat: item.deliveryLat,
            long: item.deliveryLong,
            address: item.deliveryAddress
          }))
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        // Reorder items based on optimized route
        const orderedItems = data.optimizedSequence.map((stopIndex: number) => selectedItems[stopIndex]);
        setOptimizedRoute({
          totalDistance: data.totalDistance,
          estimatedDuration: data.estimatedDuration,
          algorithm: data.algorithm,
          orderedItems
        });
        setStep(3);
      } else {
        setError(data.error || 'Failed to optimize route');
      }
    } catch (error) {
      console.error('Error optimizing route:', error);
      setError(error instanceof Error ? error.message : 'Failed to optimize route');
    } finally {
      setOptimizing(false);
    }
  };

  const handleCreatePackage = async () => {
    if (!packageName || selectedItems.length === 0 || !optimizedRoute) {
      setError('Please complete all steps');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageName,
          notes,
          warehouseLat: parseFloat(warehouseLat),
          warehouseLong: parseFloat(warehouseLong),
          totalDistance: optimizedRoute.totalDistance,
          estimatedDuration: optimizedRoute.estimatedDuration,
          routeAlgorithm: optimizedRoute.algorithm,
          items: optimizedRoute.orderedItems.map((item, index) => ({
            productId: item.productId,
            quantity: item.quantity,
            deliveryLat: item.deliveryLat,
            deliveryLong: item.deliveryLong,
            deliveryAddress: item.deliveryAddress,
            sequence: index + 1
          }))
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        router.push(`/packages/${data.package.id}/assign`);
      } else {
        setError(data.error || 'Failed to create package');
      }
    } catch (error) {
      console.error('Error creating package:', error);
      setError(error instanceof Error ? error.message : 'Failed to create package');
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-4">
        <div className={`flex items-center gap-2 ${step === 1 ? 'text-primary' : step > 1 ? 'text-green-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 1 ? 'bg-primary text-white' : step > 1 ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>
            1
          </div>
          <span className="font-medium">Select Products</span>
        </div>
        <div className="w-16 h-0.5 bg-gray-300" />
        <div className={`flex items-center gap-2 ${step === 2 ? 'text-primary' : step > 2 ? 'text-green-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 2 ? 'bg-primary text-white' : step > 2 ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>
            2
          </div>
          <span className="font-medium">Package Details</span>
        </div>
        <div className="w-16 h-0.5 bg-gray-300" />
        <div className={`flex items-center gap-2 ${step === 3 ? 'text-primary' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 3 ? 'bg-primary text-white' : 'bg-gray-200'}`}>
            3
          </div>
          <span className="font-medium">Optimize Route</span>
        </div>
      </div>

      {step === 1 && (
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
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Delivery Stops:</span>
                    <span className="font-semibold">{selectedItems.length} locations</span>
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
          {productsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              <span className="text-sm text-gray-600">Loading products...</span>
            </div>
          ) : (
            <ProductGrid
              products={products}
              categories={categories}
              onProductSelect={handleProductSelect}
              selectedProducts={selectedItems.map(item => item.productId)}
            />
          )}
        </>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Package Details & Delivery Locations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Package Info */}
            <div className="space-y-4">
              <div>
                <Label>Package Name *</Label>
                <Input
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                  placeholder="e.g., Multi-Stop Delivery #1234"
                />
              </div>

              <div>
                <Label>Notes (Optional)</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special instructions..."
                />
              </div>

              <div>
                <Label>Warehouse/Starting Location</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <Input
                    type="number"
                    step="0.0001"
                    value={warehouseLat}
                    onChange={(e) => setWarehouseLat(e.target.value)}
                    placeholder="Latitude"
                  />
                  <Input
                    type="number"
                    step="0.0001"
                    value={warehouseLong}
                    onChange={(e) => setWarehouseLong(e.target.value)}
                    placeholder="Longitude"
                  />
                </div>
              </div>
            </div>

            {/* Delivery Locations */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Delivery Stops ({selectedItems.length} locations)
              </h3>
              <div className="space-y-4">
                {selectedItems.map((item, index) => (
                  <Card key={item.productId} className="p-4 bg-gray-50">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-semibold">
                        {index + 1}
                      </div>
                      <div className="flex-1 space-y-2">
                        <p className="font-medium">{item.product.name}</p>
                        <Input
                          value={item.deliveryAddress}
                          onChange={(e) => updateItemLocation(item.productId, 'deliveryAddress', e.target.value)}
                          placeholder="Delivery address..."
                          className="text-sm"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="number"
                            step="0.0001"
                            value={item.deliveryLat}
                            onChange={(e) => updateItemLocation(item.productId, 'deliveryLat', e.target.value)}
                            placeholder="Latitude"
                            className="text-sm"
                          />
                          <Input
                            type="number"
                            step="0.0001"
                            value={item.deliveryLong}
                            onChange={(e) => updateItemLocation(item.productId, 'deliveryLong', e.target.value)}
                            placeholder="Longitude"
                            className="text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Package Summary */}
            <div className="p-4 bg-blue-50 rounded border border-blue-200">
              <h4 className="font-semibold mb-2">Package Summary</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Total Items: <span className="font-semibold">{selectedItems.length}</span></div>
                <div>Total Weight: <span className="font-semibold">{totals.totalWeight.toFixed(2)} kg</span></div>
                <div>Total Volume: <span className="font-semibold">{totals.totalVolume.toFixed(2)} cu ft</span></div>
                <div>Delivery Stops: <span className="font-semibold">{selectedItems.length}</span></div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleOptimizeRoute}
                disabled={optimizing || !packageName}
                className="flex-1"
              >
                {optimizing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Optimizing Route...
                  </>
                ) : (
                  <>
                    <RouteIcon className="mr-2 h-4 w-4" />
                    Optimize Route
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && optimizedRoute && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RouteIcon className="h-6 w-6 text-green-600" />
              Optimized Delivery Route
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Route Stats */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-green-50 rounded border border-green-200">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-700">{optimizedRoute.totalDistance.toFixed(2)} km</div>
                <div className="text-sm text-gray-600">Total Distance</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-700">{optimizedRoute.estimatedDuration} min</div>
                <div className="text-sm text-gray-600">Est. Duration</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-700">{optimizedRoute.orderedItems.length}</div>
                <div className="text-sm text-gray-600">Stops</div>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-1">Algorithm Used:</p>
              <Badge variant="outline">{optimizedRoute.algorithm}</Badge>
            </div>

            {/* Optimized Route Sequence */}
            <div>
              <h3 className="font-semibold mb-3">Delivery Sequence (Optimized)</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-100 rounded border-2 border-primary">
                  <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-semibold">
                    Start
                  </div>
                  <div>
                    <p className="font-medium">Warehouse</p>
                    <p className="text-sm text-gray-600">
                      {parseFloat(warehouseLat).toFixed(4)}, {parseFloat(warehouseLong).toFixed(4)}
                    </p>
                  </div>
                </div>

                {optimizedRoute.orderedItems.map((item, index) => (
                  <div key={item.productId} className="flex items-center gap-3 p-3 bg-white rounded border">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{item.product.name}</p>
                      <p className="text-sm text-gray-600">{item.deliveryAddress}</p>
                      <p className="text-xs text-gray-500">
                        {item.deliveryLat.toFixed(4)}, {item.deliveryLong.toFixed(4)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">Qty: {item.quantity}</p>
                      {item.product.isCritical && (
                        <Badge variant="destructive" className="text-xs">Critical</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                Back to Edit
              </Button>
              <Button
                onClick={handleCreatePackage}
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Package & Find Drivers'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
