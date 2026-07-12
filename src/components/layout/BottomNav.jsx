"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, DollarSign, Settings } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();
  
  const navItems = [
    { name: 'العمليات', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'المخزون', path: '/admin/config', icon: Package },
    { name: 'المالية', path: '/admin/finance', icon: DollarSign },
    { name: 'الإدارة', path: '/admin/reports', icon: Settings },
  ];

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.path;
        return (
          <Link key={item.path} href={item.path} className={`nav-item ${isActive ? 'active' : ''}`}>
            <Icon size={20} />
            <span className="nav-label">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
