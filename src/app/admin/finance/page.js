"use client";
import dynamic from "next/dynamic";

const FinanceHub = dynamic(() => import("@/hubs/FinanceHub"), { ssr: false });

export default function AdminFinance() {
  return <FinanceHub />;
}