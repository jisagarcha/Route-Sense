'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { Home, History, BarChart3, LogOut, User, Map, Navigation as NavigationIcon, Database, Package as PackageIcon, Truck, Building2, Route as RouteIcon, type LucideIcon } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const getNavItems = (role?: string) => {
  const baseItems: NavItem[] = [
    { href: '/', label: 'Home', icon: Home },
  ];

  const roleItems: Record<string, NavItem[]> = {
    ADMIN: [
      { href: '/admin/map', label: 'Map', icon: Map },
      { href: '/admin/warehouses', label: 'Warehouses', icon: Building2 },
      { href: '/admin/routes', label: 'Routes', icon: RouteIcon },
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
      { href: '/dispatcher/routes/new', label: 'Routes', icon: RouteIcon },
    ],
    DRIVER: [
      { href: '/driver', label: 'Driver', icon: Truck },
    ],
    ANALYST: [
      { href: '/admin/patterns', label: 'Patterns', icon: BarChart3 },
      { href: '/admin/history', label: 'History', icon: History },
      { href: '/admin/data', label: 'Data', icon: Database },
    ]
  };

  return [...baseItems, ...(roleItems[role || ''] || [])];
};

export function Navigation() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const navItems = getNavItems(
    status === 'authenticated' ? session?.user?.role : undefined
  );

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(path);
  };

  return (
    <nav className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-md shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Logo */}
          <Link 
            href="/" 
            className="group flex shrink-0 items-center gap-2 transition-all duration-300 hover:scale-105"
          >
            <div className="relative h-12 w-44 transition-transform duration-300 group-hover:brightness-110 md:h-[72px] md:w-64">
              <Image
                src="/routesenselogo.png"
                alt="RouteSense Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
          </Link>

          {/* Right Action Group: Nav Links + User Section */}
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {/* Navigation Links */}
            <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                
                return (
                  <Button
                    key={item.href}
                    asChild
                    variant={active ? 'default' : 'ghost'}
                    className={`
                      relative gap-2 transition-all duration-200
                      ${active
                        ? 'bg-[#65000B] text-white shadow-sm hover:bg-[#4d0008]'
                        : 'hover:bg-[#65000B]/10 hover:text-[#65000B]'
                      }
                    `}
                  >
                    <Link href={item.href} className={active ? 'text-white' : ''}>
                      <Icon className="h-4 w-4" />
                      <span className="hidden font-medium sm:inline">{item.label}</span>
                      {active && (
                        <span className="absolute -bottom-1 left-1/2 h-0.5 w-3/4 -translate-x-1/2 rounded-full bg-white" />
                      )}
                    </Link>
                  </Button>
                );
              })}
            </div>

            {/* User Section (Fixed right, beside nav links) */}
            <div className="flex shrink-0 items-center gap-2 border-l border-slate-200 pl-2 sm:pl-3">
              {status === 'loading' ? (
                <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
              ) : session ? (
                <>
                  <div className="hidden flex-col items-end md:flex">
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
                <Button asChild variant="outline" size="sm" className="gap-2 border-slate-200 bg-white/90 text-slate-800 shadow-2xs hover:border-[#65000B]/30 hover:bg-[#65000B]/10 hover:text-[#65000B] transition">
                  <Link href="/auth/signin">
                    <User className="h-4 w-4" />
                    Sign In
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
