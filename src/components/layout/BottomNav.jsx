"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, DollarSign, Truck } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { name: 'العمليات', path: '/admin/operations', icon: Truck },
    { name: 'المخزون', path: '/admin/inventory', icon: Package },
    { name: 'المالية', path: '/admin/finance', icon: DollarSign },
    { name: 'الإدارة', path: '/admin/dashboard', icon: LayoutDashboard },
  ];

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.path || (item.path !== '/admin/operations' && pathname.startsWith(item.path));
        return (
          <Link key={item.path} href={item.path} className={`nav-item ${isActive ? 'active' : ''}`}>
            <Icon size={22} />
            <span className="nav-label">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
