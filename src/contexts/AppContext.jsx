"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { usePrintEngine } from "@/lib/printEngine";
import { formatCurrency, formatDateArabic, getTodayString, getBehavior } from "@/lib/utils";
import { useAuth } from "./AuthContext";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const { print } = usePrintEngine();
  const { user } = useAuth();

  const [view, setView] = useState("query");
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [lastBooking, setLastBooking] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [bookingTypes, setBookingTypes] = useState([]);
  const [editBooking, setEditBooking] = useState(null);
  const [paymentRedirect, setPaymentRedirect] = useState(null);

  const userRole = user?.role || "employee";
  const setUserRole = () => {}; // no-op — role comes from AuthContext

  const fetchBookings = useCallback(async (page = 1) => {
    try {
      const params = new URLSearchParams();
      params.set("page", page);
      params.set("limit", "10");
      const res = await fetch(`/api/bookings?${params}`);
      const data = await res.json();
      if (data.success) {
        setBookings(data.bookings || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchBookingTypes();
    fetchBookings();
  }, [fetchBookings]);

  const fetchBookingTypes = async () => {
    try {
      const res = await fetch("/api/config/types");
      const data = await res.json();
      if (data.success) setBookingTypes(data.types || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrint = (booking) => {
    print("INVOICE", { ...booking, behavior: getBehavior(booking.bookingType, bookingTypes) });
  };

  const value = {
    view, setView,
    userRole, setUserRole,
    errorMsg, setErrorMsg,
    successMsg, setSuccessMsg,
    lastBooking, setLastBooking,
    bookings, setBookings,
    bookingTypes, setBookingTypes,
    fetchBookings, fetchBookingTypes,
    print, handlePrint,
    formatCurrency, formatDateArabic, getTodayString, getBehavior,
    editBooking, setEditBooking,
    paymentRedirect, setPaymentRedirect,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
