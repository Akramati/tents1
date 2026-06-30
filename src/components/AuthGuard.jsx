"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthGuard({ children }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user && pathname !== "/login") {
      router.replace("/login");
    }
    if (user && pathname === "/login") {
      router.replace("/");
    }
  }, [user, loading, pathname, router]);

  if (loading) return <div className="loading-screen">جاري التحميل...</div>;
  if (!user && pathname !== "/login") return null;

  return <>{children}</>;
}
