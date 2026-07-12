"use client";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "./BottomNav";
import { usePathname } from "next/navigation";

export default function AppShell({ children }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const showNav = user && !isLoginPage;

  return (
    <div className="app-shell" style={{ minHeight: '100vh', paddingBottom: showNav ? '70px' : '0' }}>
      {children}
      {showNav && <BottomNav />}
    </div>
  );
}
