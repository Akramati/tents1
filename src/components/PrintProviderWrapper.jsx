"use client";
import { PrintProvider } from "@/lib/printEngine";
import { AppProvider } from "@/contexts/AppContext";

export default function PrintProviderWrapper({ children }) {
  return <PrintProvider><AppProvider>{children}</AppProvider></PrintProvider>;
}
