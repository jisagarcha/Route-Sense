'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Package as PackageIcon, MapPin, User, Calendar, Loader2, Plus, Trash2 } from 'lucide-react';
import { PackageStatusBadge } from '@/components/PackageStatusBadge';

interface Package {
  id: string;
  packageName: string;
  status: string;
  totalWeight: number;
  totalVolume: number;
  isCritical: boolean;
  deliveryAddress: string | null;
  createdAt: string;
  dispatcher: { name: string | null };
  driver: { name: string | null } | null;
  items: Array<{ id: string }>;
}

const PAGE_SIZE = 20;

export default function PackagesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<Package[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
    hasMore: false,
  });

  const filteredPackages = useMemo(() => {
    const query = debouncedSearchQuery.trim().toLowerCase();
    return packages.filter((pkg) => {
      const matchesSearch = !query ||
        pkg.packageName.toLowerCase().includes(query) ||
        (pkg.deliveryAddress || '').toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'ALL' || pkg.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [packages, debouncedSearchQuery, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(0);
  }, [statusFilter]);

  const fetchPackages = useCallback(async (pageIndex = 0) => {
    setError('');
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(pageIndex * PAGE_SIZE),
      });
      if (statusFilter !== 'ALL') {
        params.set('status', statusFilter);
      }

      const res = await fetch(`/api/packages?${params}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch packages');
      }

      setPackages(data.packages || []);
      setPagination(data.pagination || {
        total: data.packages?.length || 0,
        limit: PAGE_SIZE,
        offset: pageIndex * PAGE_SIZE,
        hasMore: false,
      });
    } catch (error) {
      console.error('Error fetching packages:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch packages');
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchPackages(page);
  }, [fetchPackages, page]);

  const handleDeletePackage = async (id: string) => {
    if (!confirm('Are you sure you want to delete this package?')) return;
    
    setDeleting(id);
    try {
      const res = await fetch(`/api/packages/${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setPackages((currentPackages) => currentPackages.filter(pkg => pkg.id !== id));
        setPagination((currentPagination) => ({
          ...currentPagination,
          total: Math.max(0, currentPagination.total - 1),
        }));
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to delete package');
      }
    } catch (error) {
      console.error('Error deleting package:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete package');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Packages</h1>
            <p className="text-gray-600">Manage your delivery packages</p>
          </div>
          {(session?.user?.role === 'DISPATCHER' || session?.user?.role === 'ADMIN') && (
            <Button onClick={() => router.push('/packages/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Create Package
            </Button>
          )}
        </div>

        {/* Filters */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Input
                  placeholder="Search packages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div>
                <select
                  className="w-full px-3 py-2 border rounded-md"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">All Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="ASSIGNED">Assigned</option>
                  <option value="COLLECTED_FROM_WAREHOUSE">Collected from Warehouse</option>
                  <option value="IN_TRANSIT">In Transit</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="FAILED">Failed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              <div className="flex items-center justify-end">
                <span className="text-sm text-gray-600">
                  Showing {filteredPackages.length} of {pagination.total} packages
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Packages List */}
        {filteredPackages.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <PackageIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 mb-4">
                {packages.length === 0 ? 'No packages yet' : 'No packages match your filters'}
              </p>
              {session?.user?.role === 'DISPATCHER' && packages.length === 0 && (
                <Button onClick={() => router.push('/packages/new')}>
                  Create Your First Package
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredPackages.map(pkg => (
              <Card key={pkg.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold">{pkg.packageName}</h3>
                        <PackageStatusBadge status={pkg.status} />
                        {pkg.isCritical && (
                          <Badge variant="destructive">Critical</Badge>
                        )}
                      </div>
                      <div className="grid md:grid-cols-2 gap-2 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>{pkg.deliveryAddress || 'Delivery address pending'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>
                            Dispatcher: {pkg.dispatcher.name || 'Unknown'}
                          </span>
                        </div>
                        {pkg.driver && (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span>Driver: {pkg.driver.name || 'Unknown'}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {new Date(pkg.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600 mb-1">
                        Weight: <span className="font-medium">{pkg.totalWeight} kg</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        Volume: <span className="font-medium">{pkg.totalVolume.toFixed(2)} cu ft</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/packages/${pkg.id}`)}
                    >
                      View Details
                    </Button>
                    {pkg.status === 'PENDING' && (session?.user?.role === 'DISPATCHER' || session?.user?.role === 'ADMIN') && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/packages/${pkg.id}/assign`)}
                        >
                          Assign Driver
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeletePackage(pkg.id)}
                          disabled={deleting === pkg.id}
                        >
                          {deleting === pkg.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {pagination.total > pagination.limit && (
          <div className="mt-6 flex items-center justify-between">
            <Button
              variant="outline"
              disabled={page === 0 || loading}
              onClick={() => setPage((currentPage) => Math.max(0, currentPage - 1))}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600">
              Page {page + 1} of {Math.max(1, Math.ceil(pagination.total / pagination.limit))}
            </span>
            <Button
              variant="outline"
              disabled={!pagination.hasMore || loading}
              onClick={() => setPage((currentPage) => currentPage + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
