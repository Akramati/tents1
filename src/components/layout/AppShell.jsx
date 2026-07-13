"use client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import BottomNav from "./BottomNav";
import { usePathname } from "next/navigation";
import { Sun, Moon } from "lucide-react";

export default function AppShell({ children }) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const showNav = user && !isLoginPage;

  return (
    <div className="app-shell" style={{ minHeight: '100vh', paddingBottom: showNav ? '72px' : '0' }}>
      {showNav && (
        <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme">
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      )}
      {children}
      {showNav && <BottomNav />}
    </div>
  );
}
