"use client";
import dynamic from "next/dynamic";

const InventoryHub = dynamic(() => import("@/hubs/InventoryHub"), { ssr: false });

export default function AdminConfig() {
  return <InventoryHub />;
}