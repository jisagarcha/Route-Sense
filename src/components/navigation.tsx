'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { Home, MapPin, Route, History, BarChart3, LogOut, User, Map, Navigation as NavigationIcon, Database, Package as PackageIcon, Truck } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';

const getNavItems = (role?: string) => {
  const baseItems = [
    { href: '/', label: 'Home', icon: Home },
  ];

  const roleItems: Record<string, any[]> = {
    ADMIN: [
      { href: '/admin/map', label: 'Map', icon: Map },
      { href: '/admin/optimize', label: 'Optimize', icon: NavigationIcon },
      { href: '/admin/data', label: 'Data', icon: Database },
      // { href: '/admin/locations', label: 'Locations', icon: MapPin },
      // { href: '/admin/roads', label: 'Roads', icon: Route },
      { href: '/admin/history', label: 'History', icon: History },
      { href: '/admin/patterns', label: 'Patterns', icon: BarChart3 },
      { href: '/packages', label: 'Packages', icon: PackageIcon },
    ],
    DISPATCHER: [
      { href: '/packages', label: 'Packages', icon: PackageIcon },
      { href: '/admin/map', label: 'Map', icon: Map },
    ],
    DRIVER: [
      { href: '/delivery', label: 'My Deliveries', icon: Truck },
      { href: '/admin/map', label: 'Map', icon: Map },
    ],
    ANALYST: [
      { href: '/admin/patterns', label: 'Patterns', icon: BarChart3 },
      { href: '/admin/history', label: 'History', icon: History },
    ]
  };

  return [...baseItems, ...(roleItems[role || ''] || [])];
};

export function Navigation() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const navItems = getNavItems(session?.user?.role);

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(path);
  };

  return (
    <nav className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-md shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link 
            href="/" 
            className="group flex items-center gap-2 transition-all duration-300 hover:scale-105"
          >
            <div className="relative h-18 w-64 transition-transform duration-300 group-hover:brightness-110">
              <Image
                src="/routesenselogo.png"
                alt="RouteSense Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={active ? 'default' : 'ghost'}
                    className={`
                      relative gap-2 transition-all duration-200
                      ${active 
                        ? 'bg-primary text-primary-foreground shadow-md' 
                        : 'hover:bg-primary/10 hover:text-primary hover:shadow-sm'
                      }
                      ${active ? 'scale-105' : 'hover:scale-105'}
                    `}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{item.label}</span>
                    {active && (
                      <span className="absolute -bottom-1 left-1/2 h-0.5 w-3/4 -translate-x-1/2 rounded-full bg-primary-foreground" />
                    )}
                  </Button>
                </Link>
              );
            })}

            {/* User Section */}
            <div className="ml-4 flex items-center gap-2 border-l pl-4">
              {status === 'loading' ? (
                <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
              ) : session ? (
                <>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-medium">{session.user.name || 'User'}</span>
                    <span className="text-xs text-gray-500">{session.user.role}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => signOut({ callbackUrl: '/' })}
                    title="Sign out"
                    className="hover:bg-red-50 hover:text-red-600"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Link href="/auth/signin">
                  <Button variant="default" size="sm" className="gap-2">
                    <User className="h-4 w-4" />
                    Sign In
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
