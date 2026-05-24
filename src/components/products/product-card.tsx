import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import Image from 'next/image';

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

interface ProductCardProps {
  product: Product;
  onSelect?: (product: Product) => void;
  selected?: boolean;
}

export function ProductCard({ product, onSelect, selected }: ProductCardProps) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-lg ${
        selected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={() => onSelect?.(product)}
    >
      <CardHeader className="p-0">
        {product?.imageUrl ? (
          <div className="relative h-48 w-full overflow-hidden rounded-t-lg">
            <Image
              src={product?.imageUrl}
              alt={product?.name}
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center bg-gray-200 rounded-t-lg">
            <span className="text-gray-400">No Image</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-sm line-clamp-2">{product.name}</h3>
          {product.isCritical && (
            <Badge variant="destructive" className="text-xs shrink-0">
              Critical
            </Badge>
          )}
        </div>
        <p className="text-xs text-gray-600 line-clamp-2 mb-3">
          {product.description}
        </p>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Weight:</span>
            <span className="font-medium">{product.weight} kg</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Size:</span>
            <span className="font-medium">{product.size}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Volume:</span>
            <span className="font-medium">{product.volumeCubicFt} cu ft</span>
          </div>
        </div>
        <div className="mt-3">
          <Badge variant="outline" className="text-xs">
            {product.category}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
