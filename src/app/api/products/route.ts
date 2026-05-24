import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET /api/products - Get all products with optional filtering
export async function GET(request: NextRequest) {
  try {
    console.log('Products API called');
    
    const session = await getServerSession(authOptions);
    console.log('Session:', session ? 'exists' : 'none');
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Fetching products from database...');
    
    const products = await prisma.product.findMany({
      orderBy: { name: 'asc' },
    });

    console.log('Products found:', products.length);

    // Get unique categories for filtering
    const categories = await prisma.product.findMany({
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });

    console.log('Categories found:', categories.length);

    return NextResponse.json({
      products,
      categories: categories.map((c) => c.category),
      total: products.length,
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Stack:', error instanceof Error ? error.stack : '');
    return NextResponse.json(
      { 
        error: 'Failed to fetch products',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
