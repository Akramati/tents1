"use client";
import dynamic from "next/dynamic";
const AdminConfig = dynamic(() => import("@/views/AdminConfig"), { ssr: false });

export default function AdminConfigPage({ embedded }) {
  return <AdminConfig embedded={embedded} />;
}