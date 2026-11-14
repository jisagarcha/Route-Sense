'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DeliveryPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/driver/navigate');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <p className="mt-3 text-sm text-gray-500">Redirecting to driver navigation...</p>
      </div>
    </div>
  );
}
