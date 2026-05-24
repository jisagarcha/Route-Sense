'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Package as PackageIcon, MapPin, User, Calendar, Loader2, Plus, Trash2 } from 'lucide-react';

interface Package {
  id: string;
  packageName: string;
  status: string;
  totalWeight: number;
  totalVolume: number;
  isCritical: boolean;
  deliveryAddress: string;
  createdAt: string;
  dispatcher: { name: string | null };
  driver: { name: string | null } | null;
  items: any[];
}

export default function PackagesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<Package[]>([]);
  const [filteredPackages, setFilteredPackages] = useState<Package[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [deleting, setDeleting] = useState<string | null>(null);

  const filterPackages = () => {
    let filtered = [...packages];

    if (searchQuery) {
      filtered = filtered.filter(pkg =>
        pkg.packageName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pkg.deliveryAddress.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(pkg => pkg.status === statusFilter);
    }

    setFilteredPackages(filtered);
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  useEffect(() => {
    filterPackages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packages, searchQuery, statusFilter]);

  const fetchPackages = async () => {
    try {
      const res = await fetch('/api/packages');
      const data = await res.json();
      setPackages(data.packages || []);
    } catch (error) {
      console.error('Error fetching packages:', error);
      setPackages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePackage = async (id: string) => {
    if (!confirm('Are you sure you want to delete this package?')) return;
    
    setDeleting(id);
    try {
      const res = await fetch(`/api/packages/${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setPackages(packages.filter(pkg => pkg.id !== id));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete package');
      }
    } catch (error) {
      console.error('Error deleting package:', error);
      alert('Failed to delete package');
    } finally {
      setDeleting(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      ASSIGNED: 'bg-blue-100 text-blue-800',
      IN_TRANSIT: 'bg-purple-100 text-purple-800',
      DELIVERED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800'
    };

    return (
      <Badge className={colors[status] || 'bg-gray-100 text-gray-800'}>
        {status.replace('_', ' ')}
      </Badge>
    );
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
                  <option value="IN_TRANSIT">In Transit</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              <div className="flex items-center justify-end">
                <span className="text-sm text-gray-600">
                  Showing {filteredPackages.length} of {packages.length} packages
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
                        {getStatusBadge(pkg.status)}
                        {pkg.isCritical && (
                          <Badge variant="destructive">Critical</Badge>
                        )}
                      </div>
                      <div className="grid md:grid-cols-2 gap-2 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>{pkg.deliveryAddress}</span>
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
      </div>
    </div>
  );
}
