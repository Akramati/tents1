"use client";
import { useState, useEffect } from "react";
import { useApp } from "@/contexts/AppContext";
import { TENT_LENGTHS, TENT_WIDTHS } from "@/lib/utils";
import DualCalendarPicker from "@/components/DualCalendarPicker";

export default function CreateBookingView() {
  const { print, handlePrint, errorMsg, setErrorMsg, setLastBooking, bookingTypes, setView, getBehavior, formatCurrency, formatDateArabic, getTodayString, bookings, fetchBookings, fetchBookingTypes, editBooking, setEditBooking } = useApp();

  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    startDate: getTodayString(),
    endDate: getTodayString(),
    totalAmount: "",
    paidAmount: "",
    cashAccountCode: "1101",
    status: "قيد الانتظار",
    bookingType: "حجز خيام وباقات",
    packageUsed: "",
    notes: "",
    eventType: "",
    shift: "",
    tentLength: "",
    tentWidth: "",
    tentCount: "1",
  });
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  const [invForRent, setInvForRent] = useState([]);
  const [rentedItems, setRentedItems] = useState([]);

  const [customTypeName, setCustomTypeName] = useState("");
  const [typeFieldsConfig, setTypeFieldsConfig] = useState([]);
  const [customFieldValues, setCustomFieldValues] = useState({});

  const [varianceData, setVarianceData] = useState(null);
  const [varianceDecision, setVarianceDecision] = useState(null);

  const [inventoryWarnings, setInventoryWarnings] = useState([]);
  const [inventoryBlocked, setInventoryBlocked] = useState(false);
  const [maxPossibleLength, setMaxPossibleLength] = useState(null);
  const [invAvailability, setInvAvailability] = useState([]);
  const [calendarWarnings, setCalendarWarnings] = useState([]);
  const [hallConflict, setHallConflict] = useState(null);
  const [hallWarning, setHallWarning] = useState(null); // { body } for pending confirmation
  const [hallConflictsList, setHallConflictsList] = useState([]);

  const [aiWarnings, setAiWarnings] = useState([]);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [aiChecking, setAiChecking] = useState(false);
  const [aiDone, setAiDone] = useState(false);

  const [packages, setPackages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState("");
  const [flexiblePackages, setFlexiblePackages] = useState([]);
  const [flexibleDims, setFlexibleDims] = useState({});
  const [isFlexiblePkg, setIsFlexiblePkg] = useState(false);
  const [flexibleWidthPkg, setFlexibleWidthPkg] = useState(false);
  const [selectedFlexWidth, setSelectedFlexWidth] = useState("");

  const [pricingType, setPricingType] = useState("تفصيلي بالصنف");
  const [manualBasePrice, setManualBasePrice] = useState("");
  const [transResponsibility, setTransResponsibility] = useState("علينا (شاملة في المبلغ)");
  const [transCost, setTransCost] = useState("");
  const [depositType, setDepositType] = useState("مبلغ تأمين نقدي");
  const [depositAmount, setDepositAmount] = useState("");
  const [guarantorName, setGuarantorName] = useState("");
  const [guarantorPhone, setGuarantorPhone] = useState("");
  const [guarantorId, setGuarantorId] = useState("");
  const [customerIdNumber, setCustomerIdNumber] = useState("");
  const [customerIdPhoto, setCustomerIdPhoto] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  // Customer lookup by phone
  const [phoneLookupResults, setPhoneLookupResults] = useState([]);
  const [showPhoneLookup, setShowPhoneLookup] = useState(false);
  const [phoneLookupLoading, setPhoneLookupLoading] = useState(false);
  const [guarantorIdPhoto, setGuarantorIdPhoto] = useState("");

  const [editBookingId, setEditBookingId] = useState(null);
  const [detailMode, setDetailMode] = useState(null);
  const [detailBooking, setDetailBooking] = useState(null);
  const [msgTemplate, setMsgTemplate] = useState("");
  const [receiptTemplate, setReceiptTemplate] = useState("");
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("DHM");
  const [bookingCostCenters, setBookingCostCenters] = useState([]);
  const [selectedCostCenter, setSelectedCostCenter] = useState("");

  const behavior = getBehavior(formData.bookingType, bookingTypes);

  const loadInventoryForRent = async () => {
    try {
      const res = await fetch("/api/inventory");
      const data = await res.json();
      if (data.success) setInvForRent(data.items || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPackages = async () => {
    try {
      const res = await fetch("/api/packages");
      const data = await res.json();
      if (data.success) setPackages(data.packages || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePhoneLookup = async () => {
    const phone = formData.customerPhone?.trim();
    if (!phone || phone.length < 4) return;
    setPhoneLookupLoading(true);
    setShowPhoneLookup(true);
    try {
      const res = await fetch("/api/bookings?limit=500");
      const data = await res.json();
      if (data.success) {
        const matches = (data.bookings || []).filter(b =>
          b.customerPhone && b.customerPhone.replace(/\s/g, "").includes(phone.replace(/\s/g, ""))
        );
        // Deduplicate by customer name+phone
        const seen = new Set();
        const deduped = [];
        for (const b of matches) {
          const key = `${b.customerName || ""}|${b.customerPhone || ""}`;
          if (!seen.has(key) && b.customerName) {
            seen.add(key);
            deduped.push(b);
          }
        }
        setPhoneLookupResults(deduped);
      }
    } catch { setPhoneLookupResults([]); }
    setPhoneLookupLoading(false);
  };

  const selectPhoneLookup = (b) => {
    setFormData(prev => ({ ...prev, customerName: b.customerName || "", customerPhone: b.customerPhone || "" }));
    setCustomerIdNumber(b.customerIdNumber || "");
    setCustomerAddress(b.customerAddress || "");
    setShowPhoneLookup(false);
    setPhoneLookupResults([]);
  };

  const fetchTypeFields = async (typeName) => {
    if (!typeName) { setTypeFieldsConfig([]); return; }
    try {
      const res = await fetch(`/api/config/fields?type=${encodeURIComponent(typeName)}`);
      const data = await res.json();
      if (data.success) setTypeFieldsConfig(data.fields || []);
    } catch (err) {
      console.error(err);
      setTypeFieldsConfig([]);
    }
  };

  const handlePkgCalculate = async (pkgName, width, length, tentCount) => {
    if (!pkgName || !width || !length || isNaN(parseFloat(length)) || parseFloat(length) <= 0) {
      setRentedItems([]);
      return;
    }
    try {
      const res = await fetch(`/api/packages/calculate?packageName=${encodeURIComponent(pkgName)}&width=${width}&length=${length}`);
      const data = await res.json();
      if (data.success) {
        const tc = parseInt(tentCount || 1);
        setRentedItems(
          data.items.map((i) => ({
            itemId: i.itemId || "",
            itemName: i.itemName,
            quantity: (i.calculatedQuantity || 0) * tc,
            unitPrice: i.unitPrice?.toString() || "",
          }))
        );
      } else {
        setErrorMsg(data.error || "فشل حساب كميات الباقة");
        setRentedItems([]);
      }
    } catch (err) {
      setErrorMsg("فشل حساب كميات الباقة");
      setRentedItems([]);
    }
  };

  const handleFlexibleCalculate = async (pkgName) => {
    if (!pkgName || Object.keys(flexibleDims).length === 0 || Object.values(flexibleDims).every((v) => !v)) {
      setRentedItems([]);
      return;
    }
    try {
      const res = await fetch(`/api/packages/flexible/calculate?typeName=${encodeURIComponent(formData.bookingType)}&packageName=${encodeURIComponent(pkgName)}&dims=${encodeURIComponent(JSON.stringify(flexibleDims))}`);
      const data = await res.json();
      if (data.success) {
        setRentedItems(
          data.items.map((i) => ({
            itemId: i.itemId || "",
            itemName: i.itemName,
            quantity: i.calculatedQuantity || 0,
            unitPrice: "",
          }))
        );
      } else {
        setErrorMsg(data.error || "فشل حساب كميات الباقة");
        setRentedItems([]);
      }
    } catch (err) {
      setErrorMsg("فشل حساب كميات الباقة");
      setRentedItems([]);
    }
  };

  const handleFlexibleDimChange = (dimName, value) => {
    const newDims = { ...flexibleDims, [dimName]: value };
    setFlexibleDims(newDims);
    if (formData.packageUsed && value) {
      handleFlexibleCalculate(formData.packageUsed);
    }
  };

  const handleFlexibleWidthCalculate = async (pkgName, width) => {
    if (!pkgName || !width) { setRentedItems([]); return; }
    try {
      const res = await fetch(`/api/packages/flexible/calculate?typeName=${encodeURIComponent(formData.bookingType)}&packageName=${encodeURIComponent(pkgName)}&width=${width}`);
      const data = await res.json();
      if (data.success) {
        setRentedItems(data.items.map((i) => ({ itemId: i.itemId, itemName: i.itemName, quantity: i.calculatedQuantity || 0, unitPrice: "" })));
      } else {
        setErrorMsg(data.error || "فشل حساب كميات الباقة");
        setRentedItems([]);
      }
    } catch (err) {
      setErrorMsg("فشل حساب كميات الباقة");
      setRentedItems([]);
    }
  };

  const computeVariance = async (bookingId, pkgName, width, length, tentCount, preloadedSaved) => {
    try {
      setVarianceDecision(null);
      let savedItems = preloadedSaved || [];
      if (savedItems.length === 0) {
        const savedRes = await fetch(`/api/bookings/rented-items?bookingId=${bookingId}`);
        const savedData = await savedRes.json();
        savedItems = (savedData.success ? savedData.items : []) || [];
      }
      const stdRes = await fetch(`/api/packages/calculate?packageName=${encodeURIComponent(pkgName)}&width=${width}&length=${length}`);
      const stdData = await stdRes.json();
      const tc = parseInt(tentCount || 1);
      const standardItems = (stdData.success ? stdData.items : []).map((i) => ({
        itemId: i.itemId || "",
        itemName: i.itemName,
        quantity: (i.calculatedQuantity || 0) * tc,
      }));
      const savedMap = {};
      for (const s of savedItems) savedMap[s.itemId || s.itemId] = s.quantityRequested || s.quantity || 0;
      const stdMap = {};
      for (const s of standardItems) stdMap[s.itemId] = s.quantity;
      const modified = [];
      const added = [];
      const deleted = [];
      for (const s of savedItems) {
        const id = s.itemId;
        const savedQty = s.quantityRequested || s.quantity || 0;
        if (stdMap[id] !== undefined) {
          if (savedQty !== stdMap[id]) modified.push({ itemId: id, itemName: s.itemName, savedQty, standardQty: stdMap[id] });
        } else {
          added.push({ itemId: id, itemName: s.itemName, savedQty });
        }
      }
      for (const s of standardItems) {
        if (!savedMap[s.itemId]) {
          deleted.push({ itemId: s.itemId, itemName: s.itemName, standardQty: s.quantity });
        }
      }
      const hasDiff = modified.length > 0 || added.length > 0 || deleted.length > 0;
      setVarianceData(hasDiff ? { savedItems, standardItems, modified, added, deleted } : null);
    } catch (err) {
      console.error("Variance compute error:", err);
    }
  };

  const validateInventory = async (startDate, endDate, items) => {
    if (!startDate || !endDate || !items || items.length === 0) {
      setInventoryWarnings([]);
      setInventoryBlocked(false);
      setMaxPossibleLength(null);
      return;
    }
    try {
      const excludeParam = editBookingId ? `&excludeBookingId=${editBookingId}` : "";
      const res = await fetch(`/api/inventory/available?startDate=${startDate}&endDate=${endDate}${excludeParam}`);
      const data = await res.json();
      if (!data.success) return;
      setInvAvailability(data.items || []);

      const warnings = [];
      let blocked = false;
      for (const ri of items) {
        if (!ri.itemId || !ri.quantity) continue;
        const inv = (data.items || []).find((i) => i.itemId === ri.itemId);
        if (inv && ri.quantity > inv.availableQuantity) {
          warnings.push({
            itemId: ri.itemId,
            itemName: ri.itemName || inv.itemName,
            requested: ri.quantity,
            available: inv.availableQuantity,
          });
          blocked = true;
        }
      }
      setInventoryWarnings(warnings);
      setInventoryBlocked(blocked);
      setCalendarWarnings(data.calendarWarnings || []);

      if (getBehavior(formData.bookingType, bookingTypes) === "packages" && formData.packageUsed && formData.tentWidth) {
        const pkg = packages.find((p) => p.packageName === formData.packageUsed);
        const widthItems = pkg?.widths?.[formData.tentWidth];
        if (widthItems && widthItems.length > 0) {
          const maxTest = 100;
          let bestLength = 10;
          for (let len = 10; len <= maxTest; len++) {
            let allFit = true;
            for (const wi of widthItems) {
              if (!wi.itemId) continue;
              const inv = (data.items || []).find((i) => i.itemId === wi.itemId);
              if (!inv) continue;
              const extra = len - 10;
              const tens = Math.floor(extra / 10);
              const fives = (extra % 10) >= 5 ? 1 : 0;
              const qtyNeeded = wi.baseQty + tens * wi.step10Qty + fives * wi.step5Qty;
              if (qtyNeeded > inv.availableQuantity) {
                allFit = false;
                break;
              }
            }
            if (allFit) bestLength = len;
            else break;
          }
          setMaxPossibleLength(bestLength >= 10 ? bestLength : null);
        }
      }
    } catch (err) {
      console.error("Inventory validation error:", err);
    }
  };

  const handleSizeChange = (field, value) => {
    const newForm = { ...formData, [field]: value };
    const len = field === "tentLength" ? value : newForm.tentLength;
    const wid = field === "tentWidth" ? value : newForm.tentWidth;
    const tc = field === "tentCount" ? value : newForm.tentCount;
    newForm[field] = value;
    setFormData(newForm);
    setVarianceData(null);
    setVarianceDecision(null);
    if (getBehavior(newForm.bookingType, bookingTypes) === "packages" && newForm.packageUsed && len && wid) {
      handlePkgCalculate(newForm.packageUsed, wid, len, tc);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "startDate" && value > next.endDate) {
        next.endDate = value;
      }
      return next;
    });
  };

  const addRentedItem = () => {
    if (detailMode === "view") return;
    setRentedItems([...rentedItems, { itemId: "", itemName: "", quantity: 1, unitPrice: "" }]);
  };

  const removeRentedItem = (idx) => {
    if (detailMode === "view") return;
    setRentedItems(rentedItems.filter((_, i) => i !== idx));
  };

  const updateRentedItem = (idx, field, value) => {
    if (detailMode === "view") return;
    const updated = [...rentedItems];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === "itemId") {
      const inv = invForRent.find((i) => i.itemId === value);
      updated[idx].itemName = inv ? inv.itemName : "";
    }
    setRentedItems(updated);
  };

  const handleAiCheck = async () => {
    if (!formData.customerName || !formData.startDate || !formData.endDate) {
      setErrorMsg("يرجى إكمال البيانات الأساسية أولاً");
      return;
    }
    setAiChecking(true);
    setAiDone(false);
    setAiWarnings([]);
    setAiSuggestions([]);
    try {
      const res = await fetch("/api/ai-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: formData.customerName,
          startDate: formData.startDate,
          endDate: formData.endDate,
          totalAmount: Number(formData.totalAmount || 0),
          bookingType: formData.bookingType,
          shift: formData.shift,
          rentedItems: rentedItems.filter((ri) => ri.itemId).map((ri) => ({
            itemId: ri.itemId,
            itemName: ri.itemName,
            quantityRequested: ri.quantity || 1,
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAiWarnings(data.warnings || []);
        setAiSuggestions(data.suggestions || []);
        if (data.safe) setSuccessMsg("✅ الفحص الذكي: لا توجد مشاكل");
      } else {
        setErrorMsg(data.error || "فشل الفحص الذكي");
      }
    } catch (err) {
      setErrorMsg("فشل الاتصال بالخادم");
    }
    setAiChecking(false);
    setAiDone(true);
  };

  const startEditBooking = async (booking) => {
    setDetailMode(null);
    setEditBookingId(booking.bookingId);
    setFormData({
      customerName: booking.customerName || "",
      customerPhone: booking.customerPhone || "",
      startDate: booking.startDate || getTodayString(),
      endDate: booking.endDate || getTodayString(),
      totalAmount: booking.totalAmount?.toString() || "",
      paidAmount: booking.paidAmount?.toString() || "",
      status: booking.status || "مؤكد",
      bookingType: booking.bookingType || "حجز خيام وباقات",
      packageUsed: booking.packageUsed || "",
      notes: booking.notes || "",
      eventType: booking.eventType || "",
      shift: booking.shift || "",
      tentLength: booking.tentLength || "",
      tentWidth: booking.tentWidth || "",
      tentCount: booking.tentCount || "1",
    });
    setCustomFieldValues(booking.customFields || {});
    setRentedItems([]);
    setVarianceData(null);
    setVarianceDecision(null);
    setPricingType(booking.pricingType || "تفصيلي بالصنف");
    setManualBasePrice("");
    setTransResponsibility(booking.transResponsibility || "علينا (شاملة في المبلغ)");
    setTransCost(booking.transCost?.toString() || "");
    setDepositType(booking.depositType || "مبلغ تأمين نقدي");
    setDepositAmount("");
    setGuarantorName(booking.guarantorName || "");
    setGuarantorPhone(booking.guarantorPhone || "");
    setGuarantorId(booking.guarantorId || "");
    setCustomerIdNumber(booking.customerIdNumber || "");
    setCustomerIdPhoto(booking.customerIdPhoto || "");
    setCustomerAddress(booking.customerAddress || "");
    setGuarantorIdPhoto(booking.guarantorIdPhoto || "");
    setView("create");
    const isPendingOrCancelled = booking.status === "قيد الانتظار" || booking.status === "ملغي";
    if (booking.bookingType === "حجز خيام وباقات" && booking.packageUsed && booking.tentWidth && booking.tentLength) {
      if (!isPendingOrCancelled) {
        try {
          const savedRes = await fetch(`/api/bookings/rented-items?bookingId=${booking.bookingId}`);
          const savedData = await savedRes.json();
          const savedItems = (savedData.success ? savedData.items : []) || [];
          if (savedItems.length > 0) {
            setRentedItems(savedItems.map((si) => ({ itemId: si.itemId || "", itemName: si.itemName, quantity: si.quantityRequested || 0, unitPrice: si.unitPrice?.toString() || "" })));
            computeVariance(booking.bookingId, booking.packageUsed, booking.tentWidth, booking.tentLength, booking.tentCount, savedItems);
          } else {
            handlePkgCalculate(booking.packageUsed, booking.tentWidth, booking.tentLength, booking.tentCount);
          }
        } catch (err) {
          handlePkgCalculate(booking.packageUsed, booking.tentWidth, booking.tentLength, booking.tentCount);
        }
      } else {
        handlePkgCalculate(booking.packageUsed, booking.tentWidth, booking.tentLength, booking.tentCount);
      }
    } else if (getBehavior(booking.bookingType, bookingTypes) === "individual") {
      if (!isPendingOrCancelled) {
        try {
          const savedRes = await fetch(`/api/bookings/rented-items?bookingId=${booking.bookingId}`);
          const savedData = await savedRes.json();
          const savedItems = (savedData.success ? savedData.items : []) || [];
          if (savedItems.length > 0) {
            setRentedItems(savedItems.map((si) => ({ itemId: si.itemId || "", itemName: si.itemName, quantity: si.quantityRequested || 0, unitPrice: si.unitPrice?.toString() || "" })));
          }
        } catch (err) {
          // silently fail
        }
      }
    }
    if (booking._detailMode === "view") {
      setDetailMode("view");
      setDetailBooking(booking);
    }
  };

  const fillTemplate = (booking) => {
    if (!msgTemplate) return "";
    const contractPart = booking.contractLink ? `\n📄 رابط العقد: ${booking.contractLink}` : "";
    const map = {
      customerName: booking.customerName || "",
      customerPhone: booking.customerPhone || "",
      bookingId: booking.bookingId || "",
      startDate: formatDateArabic(booking.startDate),
      endDate: formatDateArabic(booking.endDate),
      totalAmount: formatCurrency(booking.totalAmount),
      paidAmount: formatCurrency(booking.paidAmount),
      remainingAmount: formatCurrency(booking.remainingAmount),
      bookingType: booking.bookingType || "",
      contractLink: contractPart,
      notes: booking.notes || "",
      eventType: booking.eventType || "",
      shift: booking.shift || "",
      guarantorName: booking.guarantorName || "",
      guarantorPhone: booking.guarantorPhone || "",
      customerAddress: booking.customerAddress || "",
      customerIdNumber: booking.customerIdNumber || "",
    };
    return msgTemplate.replace(/\{(\w+)\}/g, (_, k) => map[k] ?? `{${k}}`);
  };

  const confirmHallOverride = async () => {
    if (!hallWarning) return;
    const { body, isEdit } = hallWarning;
    setHallWarning(null);
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const tk = localStorage.getItem("token");
      setHallConflictsList([]);
      const res = await fetch("/api/bookings", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        if (detailMode === "edit") {
          setDetailMode(null);
          setDetailBooking(null);
          setEditBookingId(null);
          setVarianceData(null);
          setVarianceDecision(null);
          setView("query");
          setSuccessMsg("✅ تم تحديث الحجز بنجاح");
          return;
        }
        setSuccessMsg(isEdit ? "تم تحديث الحجز بنجاح" : "تم تسجيل الحجز بنجاح وإضافته إلى جدول البيانات!");
        setLastBooking(data.booking);
        setEditBookingId(null);
        setDetailMode(null);
        setDetailBooking(null);
        setVarianceData(null);
        setVarianceDecision(null);
        setFormData({
          customerName: "",
          customerPhone: "",
          startDate: getTodayString(),
          endDate: getTodayString(),
          totalAmount: "",
          paidAmount: "",
          status: "قيد الانتظار",
          bookingType: "حجز خيام وباقات",
          packageUsed: "",
          notes: "",
          eventType: "",
          shift: "",
          tentLength: "",
          tentWidth: "",
          tentCount: "1",
        });
        setRentedItems([]);
        setCustomFieldValues({});
        setPricingType("تفصيلي بالصنف");
        setManualBasePrice("");
        setTransResponsibility("علينا (شاملة في المبلغ)");
        setTransCost("");
        setDepositType("مبلغ تأمين نقدي");
        setDepositAmount("");
        setGuarantorName("");
        setGuarantorPhone("");
        setGuarantorId("");
        setCustomerIdNumber("");
        setCustomerIdPhoto("");
        setCustomerAddress("");
        setGuarantorIdPhoto("");
        setSelectedCostCenter("");
        setView("query");
      } else {
        setErrorMsg(data.error || "فشل في حفظ الحجز");
      }
    } catch (error) {
      console.error(error);
      setErrorMsg("فشل الاتصال بالخادم لحفظ الحجز");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelHallOverride = () => {
    setHallWarning(null);
    setHallConflictsList([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customerName || !formData.customerPhone || !formData.startDate || !formData.endDate) {
      setErrorMsg("الرجاء ملء جميع الحقول الأساسية");
      return;
    }
      // For non-hall bookings with packages/individual, items are required
      if (behavior !== "hall" && rentedItems.length === 0 && !["individual","hall"].includes(behavior)) {
        setErrorMsg("⚠️ لم يتم تحميل الأصناف — اختر الباقة والأبعاد أولاً");
        setSubmitting(false);
        return;
      }

      // Items that need inventory must show first
      if (behavior === "packages" && !formData.packageUsed) {
        setErrorMsg("⚠️ اختر الباقة والأبعاد لتحميل الأصناف قبل الحفظ");
        setSubmitting(false);
        return;
      }
    if (behavior === "hall" && (!formData.eventType || !formData.shift)) {
      setErrorMsg("نوع المناسبة والفترة مطلوبان لحجز الصالة");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const isEdit = !!editBookingId;
      const finalStatus = Number(formData.paidAmount || 0) > 0 ? formData.status : "قيد الانتظار";
      if (isEdit && formData.status === "مؤكد" && finalStatus !== "مؤكد") {
        setErrorMsg("لا يمكن تغيير حجز مؤكد إلى قيد الانتظار. يمكنك إلغاء الحجز فقط.");
        setSubmitting(false);
        return;
      }
      const body = {
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        startDate: formData.startDate,
        endDate: formData.endDate,
        totalAmount: Number(formData.totalAmount || 0),
        paidAmount: Number(formData.paidAmount || 0),
        cashAccountCode: formData.cashAccountCode || "1101",
        status: finalStatus,
        bookingType: formData.bookingType,
        packageUsed: formData.packageUsed,
        notes: formData.notes,
        eventType: formData.eventType,
        shift: formData.shift,
        tentLength: formData.tentLength,
        tentWidth: formData.tentWidth,
        tentCount: formData.tentCount,
        pricingType: behavior === "individual" ? pricingType : "",
        depositType: behavior === "individual" ? depositType : "",
        guarantorName: behavior === "individual" ? guarantorName : "",
        guarantorPhone: behavior === "individual" ? guarantorPhone : "",
        guarantorId: behavior === "individual" ? guarantorId : "",
        customerIdNumber: customerIdNumber || "",
        customerIdPhoto: customerIdPhoto || "",
        customerAddress: customerAddress || "",
        guarantorIdPhoto: guarantorIdPhoto || "",
        transResponsibility: behavior === "individual" ? transResponsibility : "",
        transCost: behavior === "individual" ? (parseFloat(transCost) || 0) : 0,
        rentedItems: behavior !== "hall"
          ? rentedItems.filter((ri) => ri.itemId).map((ri) => ({
              itemId: ri.itemId,
              itemName: ri.itemName,
              quantityRequested: ri.quantity || 1,
              unitPrice: parseFloat(ri.unitPrice) || 0,
            }))
          : [],
        customFields: customFieldValues,
        costCenter: selectedCostCenter || "",
        costCenterType: selectedCostCenter ? "booking" : "",
      };
      if (isEdit) body.bookingId = editBookingId;

      // Hall overlap check — applies to ALL booking types
      const tk = localStorage.getItem("token");
      if (!hallWarning) {
        const hcRes = await fetch("/api/bookings/check-hall", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startDate: formData.startDate,
            endDate: formData.endDate,
            excludeBookingId: editBookingId || undefined,
            typeName: formData.bookingType,
            shift: formData.shift,
          }),
        });
        const hcData = await hcRes.json();
        if (hcData.success && hcData.conflict) {
          setHallConflictsList(hcData.bookings);
          if (behavior === "hall") {
            setErrorMsg("⛔ التاريخ أو الفترة محجوزة مسبقاً — لا يمكن تكرار الحجز");
            setSubmitting(false);
            return;
          }
          // Non-hall booking: show warning and pause submission
          setHallWarning({ body, isEdit });
          setSubmitting(false);
          return;
        }
      }

      const res = await fetch("/api/bookings", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        if (detailMode === "edit") {
          setDetailMode(null);
          setDetailBooking(null);
          setEditBookingId(null);
          setVarianceData(null);
          setVarianceDecision(null);
          setView("query");
          setSuccessMsg("✅ تم تحديث الحجز بنجاح");
          return;
        }
        setSuccessMsg(isEdit ? "تم تحديث الحجز بنجاح" : "تم تسجيل الحجز بنجاح وإضافته إلى جدول البيانات!");
        setLastBooking(data.booking);
        setEditBookingId(null);
        setDetailMode(null);
        setDetailBooking(null);
        setVarianceData(null);
        setVarianceDecision(null);
        setFormData({
          customerName: "",
          customerPhone: "",
          startDate: getTodayString(),
          endDate: getTodayString(),
          totalAmount: "",
          paidAmount: "",
          status: "قيد الانتظار",
          bookingType: "حجز خيام وباقات",
          packageUsed: "",
          notes: "",
          eventType: "",
          shift: "",
          tentLength: "",
          tentWidth: "",
          tentCount: "1",
        });
        setRentedItems([]);
        setCustomFieldValues({});
        setPricingType("تفصيلي بالصنف");
        setManualBasePrice("");
        setTransResponsibility("علينا (شاملة في المبلغ)");
        setTransCost("");
        setDepositType("مبلغ تأمين نقدي");
        setDepositAmount("");
        setGuarantorName("");
        setGuarantorPhone("");
        setGuarantorId("");
        setCustomerIdNumber("");
        setCustomerIdPhoto("");
        setCustomerAddress("");
        setGuarantorIdPhoto("");
        setSelectedCostCenter("");
        setView("query");
      } else {
        setErrorMsg(data.error || "فشل في حفظ الحجز");
      }
    } catch (error) {
      console.error(error);
      setErrorMsg("فشل الاتصال بالخادم لحفظ الحجز");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchPackages();
    fetchBookingTypes();
    loadInventoryForRent();
    fetch("/api/finance/branches").then(r => r.json()).then(d => { if (d.success) { setBranches(d.branches || []); if (d.branches.length > 0 && !d.branches.some(b => b.code === selectedBranch)) setSelectedBranch(d.branches[0].code); } }).catch(() => {});
    fetch("/api/finance/cost-centers").then(r => r.json()).then(d => { if (d.success) setBookingCostCenters((d.centers || []).filter(c => c.type === "booking" || c.type === "administrative")); }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchTypeFields(formData.bookingType);
    setCustomFieldValues({});
    setFlexibleDims({});
    setSelectedFlexWidth("");
    setFlexibleWidthPkg(false);
    // Load flexible packages for this type
    (async () => {
      if (getBehavior(formData.bookingType, bookingTypes) !== "packages") {
        setFlexiblePackages([]);
        setIsFlexiblePkg(false);
        return;
      }
      try {
        const res = await fetch(`/api/packages/flexible?typeName=${encodeURIComponent(formData.bookingType)}`);
        const data = await res.json();
        if (data.success && data.packages.length > 0) {
          setFlexiblePackages(data.packages);
          setIsFlexiblePkg(true);
        } else {
          setFlexiblePackages([]);
          setIsFlexiblePkg(false);
        }
      } catch { setFlexiblePackages([]); setIsFlexiblePkg(false); }
    })();
  }, [formData.bookingType]);

  useEffect(() => {
    if (formData.startDate && formData.endDate && rentedItems.length > 0) {
      validateInventory(formData.startDate, formData.endDate, rentedItems);
    } else {
      setInventoryWarnings([]);
      setInventoryBlocked(false);
      setMaxPossibleLength(null);
      setCalendarWarnings([]);
    }
  }, [formData.startDate, formData.endDate, rentedItems]);

  useEffect(() => {
    if (behavior !== "individual") return;
    let base = 0;
    if (pricingType === "تفصيلي بالصنف") {
      base = rentedItems.reduce((sum, item) => sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)), 0);
    } else if (pricingType === "مبلغ شامل مقطوع") {
      base = parseFloat(manualBasePrice) || 0;
    }
    const transport = transResponsibility === "على الزبون" ? (parseFloat(transCost) || 0) : 0;
    const total = base + transport;
    setFormData((prev) => ({ ...prev, totalAmount: total > 0 ? total.toString() : "" }));
  }, [formData.bookingType, pricingType, manualBasePrice, transResponsibility, transCost, rentedItems, behavior]);

  useEffect(() => {
    if (!formData.startDate || !formData.endDate) {
      setHallConflict(null);
      setHallConflictsList([]);
      return;
    }
    const bookingType = formData.bookingType || "";
    const isCourtyard = bookingType.includes("حوش");
    const hasConflict = bookings.some((b) => {
      const bType = (b.bookingType || "").trim();
      const bStatus = (b.status || "").trim();
      if (!bType.includes("صالة") && !bType.includes("حوش")) return false;
      if (bStatus === "مكتمل" || bStatus === "منتهي" || bStatus === "ملغي") return false;
      if (editBookingId && b.bookingId === editBookingId) return false;
      if ((isCourtyard && !bType.includes("حوش")) || (!isCourtyard && bType.includes("حوش"))) return false;
      const bStart = new Date(b.startDate);
      const bEnd = new Date(b.endDate);
      const reqStart = new Date(formData.startDate);
      const reqEnd = new Date(formData.endDate);
      bStart.setHours(0,0,0,0); bEnd.setHours(0,0,0,0);
      reqStart.setHours(0,0,0,0); reqEnd.setHours(0,0,0,0);
      if (!(reqStart <= bEnd && reqEnd >= bStart)) return false;
      const bShift = (b.shift || "").trim();
      if (formData.shift === "يوم كامل" || bShift === "يوم كامل") return true;
      if (formData.shift && bShift && formData.shift === bShift) return true;
      return false;
    });
    // Preview list: ALL hall/courtyard bookings in range (for info, regardless of type)
    const previewList = bookings.filter((b) => {
      const bType = (b.bookingType || "").trim();
      const bStatus = (b.status || "").trim();
      if (!bType.includes("صالة") && !bType.includes("حوش")) return false;
      if (bStatus === "مكتمل" || bStatus === "منتهي" || bStatus === "ملغي") return false;
      if (editBookingId && b.bookingId === editBookingId) return false;
      const bStart = new Date(b.startDate);
      const bEnd = new Date(b.endDate);
      const reqStart = new Date(formData.startDate);
      const reqEnd = new Date(formData.endDate);
      bStart.setHours(0,0,0,0); bEnd.setHours(0,0,0,0);
      reqStart.setHours(0,0,0,0); reqEnd.setHours(0,0,0,0);
      return reqStart <= bEnd && reqEnd >= bStart;
    });
    setHallConflict(hasConflict);
    setHallConflictsList(previewList);
  }, [formData.startDate, formData.endDate, formData.bookingType, formData.shift, editBookingId, bookings]);

  useEffect(() => {
    fetch("/api/config/message?type=bookingConfirm").then(r => r.json()).then(d => { if (d.success) setMsgTemplate(d.template); }).catch(() => {});
    fetch("/api/config/message?type=paymentReceipt").then(r => r.json()).then(d => { if (d.success) setReceiptTemplate(d.template); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (editBooking) { startEditBooking(editBooking); setEditBooking(null); } }, [editBooking]);

  // Auto-select cost center when booking type or branch changes
  useEffect(() => {
    if (!selectedBranch || !formData.bookingType || !bookingTypes.length) return;
    const bt = bookingTypes.find(t => t.typeName === formData.bookingType);
    // Use configured cost center from type if set
    if (bt?.costCenterCode) {
      if (bookingCostCenters.find(c => c.code === bt.costCenterCode)) {
        setSelectedCostCenter(bt.costCenterCode);
        return;
      }
    }
    // Fallback to inferring from typeCode
    const typeCode = bt?.typeCode || "";
    const expected = `CC-${selectedBranch}-${typeCode}`;
    const match = bookingCostCenters.find(c => c.code === expected);
    if (match) setSelectedCostCenter(match.code);
    else setSelectedCostCenter("");
  }, [formData.bookingType, selectedBranch, bookingTypes]);

  return (
    <section className="create-section glass">
      <h2>{detailMode === "view" ? `🔍 عرض الحجز ${editBookingId}` : detailMode === "edit" ? `✏️ تعديل الحجز ${editBookingId}` : "تسجيل حجز جديد"}</h2>
      <p className="subtitle">{detailMode === "view" ? "عرض تفاصيل الحجز — جميع الحقول في وضع القراءة فقط" : detailMode === "edit" ? "قم بتعديل البيانات ثم اضغط على حفظ التعديلات" : "اختر نوع الحجز أولاً لتظهر الحقول المناسبة"}</p>

      <form onSubmit={handleSubmit} className="booking-form">
        <fieldset disabled={detailMode === "view"} style={{ border: "none", padding: 0, margin: 0 }}>
        <div className="form-grid">
          {/* 1. Dates — first row */}
          <div className="form-group">
            <label htmlFor="startDate">تاريخ البداية <span className="required">*</span></label>
            <DualCalendarPicker id="startDate" name="startDate" value={formData.startDate} required
              onChange={(val) => {
                setFormData((prev) => {
                  const next = { ...prev, startDate: val };
                  if (val > next.endDate) next.endDate = val;
                  return next;
                });
              }} />
          </div>
          <div className="form-group">
            <label htmlFor="endDate">تاريخ النهاية <span className="required">*</span></label>
            <DualCalendarPicker id="endDate" name="endDate" value={formData.endDate} required
              onChange={(val) => setFormData((prev) => ({ ...prev, endDate: val }))} />
          </div>

          {/* 2. Customer — second row */}
          <div className="form-group">
            <label htmlFor="customerName">اسم العميل بالكامل <span className="required">*</span></label>
            <input type="text" id="customerName" name="customerName" value={formData.customerName} onChange={handleInputChange} placeholder="مثال: محمد بن عبد العزيز" required className="form-control" />
          </div>
          <div className="form-group">
            <label htmlFor="customerPhone">رقم جوال العميل <span className="required">*</span></label>
            <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
              <input type="tel" id="customerPhone" name="customerPhone" value={formData.customerPhone} onChange={handleInputChange} placeholder="مثال: 0555555555" required className="form-control" style={{ flex: 1 }} />
              <button type="button" className="btn btn-sm btn-ghost" style={{ fontSize: "0.7rem", padding: "0.35rem 0.5rem", whiteSpace: "nowrap" }}
                onClick={handlePhoneLookup} disabled={phoneLookupLoading || !formData.customerPhone?.trim()}>
                {phoneLookupLoading ? "..." : "🔍 بحث"}
              </button>
            </div>
            {showPhoneLookup && (
              <div className="lookup-dropdown" style={{ position: "relative", marginTop: "0.25rem" }}>
                {phoneLookupResults.length === 0 && !phoneLookupLoading && (
                  <div className="lookup-empty" style={{ padding: "0.5rem", fontSize: "0.75rem", textAlign: "center", opacity: 0.6 }}>لا توجد نتائج</div>
                )}
                {phoneLookupResults.map((b, i) => (
                  <div key={i} className="lookup-item" onClick={() => selectPhoneLookup(b)}>
                    <div className="lookup-item-main">
                      <span className="lookup-item-name">{b.customerName}</span>
                      <span className="lookup-item-id">{b.customerPhone}</span>
                    </div>
                    <div className="lookup-item-sub">
                      <span>آخر حجز: {b.startDate || "-"}</span>
                      <span>{b.bookingId}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Customer extra fields */}
          <div className="form-group">
            <label>رقم البطاقة/الهوية</label>
            <input type="text" value={customerIdNumber} onChange={(e) => setCustomerIdNumber(e.target.value)} placeholder="رقم البطاقة الشخصية" className="form-control" />
          </div>
          <div className="form-group">
            <label>صورة بطاقة العميل</label>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <label htmlFor="upload-customer-id" className="btn btn-sm btn-gold" style={{ cursor: detailMode === "view" ? "default" : "pointer", whiteSpace: "nowrap", opacity: detailMode === "view" ? 0.5 : 1 }}>
                📁 رفع صورة
              </label>
              <input type="file" id="upload-customer-id" accept="image/*" style={{ display: "none" }} disabled={detailMode === "view"} onChange={async (e) => {
                if (detailMode === "view") return;
                const file = e.target.files?.[0];
                if (!file) return;
                const fd = new FormData();
                fd.append("file", file);
                try {
                  const res = await fetch("/api/upload", { method: "POST", body: fd });
                  const data = await res.json();
                  if (data.success) setCustomerIdPhoto(data.url);
                } catch (err) { console.error("Upload failed", err); }
              }} />
              {customerIdPhoto && (
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => { if (detailMode === "view") return; const el = document.getElementById("upload-customer-id"); el.value = ""; setCustomerIdPhoto(""); }} disabled={detailMode === "view"} style={{ padding: "0.25rem 0.5rem" }}>❌</button>
              )}
            </div>
            {customerIdPhoto && (
              <div style={{ marginTop: "0.5rem", borderRadius: "8px", overflow: "hidden", maxWidth: "120px", border: "1px solid rgba(255,255,255,0.1)" }}>
                <img src={customerIdPhoto} alt="بطاقة العميل" style={{ width: "100%", height: "auto", display: "block" }} onError={(e) => { e.target.style.display = "none"; }} />
              </div>
            )}
          </div>
          <div className="form-group full-width">
            <label>العنوان</label>
            <input type="text" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="عنوان العميل (الشارع، الحي، المدينة)" className="form-control" />
          </div>

          {/* 3. Booking Type — full width */}
          <div className="form-group full-width">
            <label htmlFor="bookingType">نوع الحجز <span className="required">*</span></label>
            <div className="type-select-row">
              <select
                id="bookingType"
                name="bookingType"
                value={formData.bookingType === "__new__" ? "__new__" : formData.bookingType}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "__new__") {
                    setCustomTypeName("");
                    return;
                  }
                  setFormData((prev) => ({ ...prev, bookingType: val, packageUsed: "", tentLength: "", tentWidth: "", tentCount: "1", eventType: "", shift: "" }));
                  setRentedItems([]);
                  setSelectedPackage("");
                  setPricingType("تفصيلي بالصنف");
                  setManualBasePrice("");
                  setTransResponsibility("علينا (شاملة في المبلغ)");
                  setTransCost("");
                  setDepositType("مبلغ تأمين نقدي");
                  setDepositAmount("");
                  setGuarantorName("");
                  setGuarantorPhone("");
                  setGuarantorId("");
                }}
                className="form-control"
              >
                {bookingTypes.map((t) => (
                  <option key={t.typeName} value={t.typeName}>{t.icon} {t.typeName}</option>
                ))}
                <option value="__new__">➕ إضافة نوع جديد...</option>
              </select>
              {formData.bookingType === "__new__" && (
                <div className="new-type-inline">
                  <input
                    type="text"
                    value={customTypeName}
                    onChange={(e) => setCustomTypeName(e.target.value)}
                    placeholder="اسم النوع الجديد..."
                    className="form-control"
                    style={{flex:1}}
                  />
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={!customTypeName.trim() || detailMode === "view"}
                    onClick={async () => {
                      if (detailMode === "view") return;
                      const name = customTypeName.trim();
                      if (!name) return;
                      try {
                        const res = await fetch("/api/config/types", {
                          method: "POST",
                          headers: {"Content-Type":"application/json"},
                          body: JSON.stringify({ typeName: name, behavior: "individual", icon: "📦" }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          await fetchBookingTypes();
                          setFormData((prev) => ({ ...prev, bookingType: name }));
                          setCustomTypeName("");
                        } else {
                          setErrorMsg(data.error || "فشل إضافة النوع");
                        }
                      } catch { setErrorMsg("خطأ في الاتصال"); }
                    }}
                  >
                    تأكيد
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 4a. Packages fields — tent or flexible */}
          {behavior === "packages" && (
            <>
              {/* Package selector (shared) */}
              <div className="form-group">
                <label htmlFor="packageUsed">الباقة المختارة <span className="required">*</span></label>
                <select
                  id="packageUsed"
                  name="packageUsed"
                  value={formData.packageUsed}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedPackage(val);
                    setRentedItems([]);
                    setVarianceData(null);
                    setVarianceDecision(null);
                    const newForm = { ...formData, packageUsed: val };
                    setFormData(newForm);
                    if (isFlexiblePkg && val) {
                      const pkg = flexiblePackages.find((p) => p.packageName === val);
                      if (pkg) {
                        if (pkg.widths && pkg.widths.length > 0) {
                          setFlexibleWidthPkg(true);
                          setSelectedFlexWidth(pkg.widths[0]);
                          handleFlexibleWidthCalculate(val, pkg.widths[0]);
                        } else {
                          setFlexibleWidthPkg(false);
                          setSelectedFlexWidth("");
                          const initialDims = {};
                          for (const d of pkg.dims) initialDims[d.dim] = "";
                          setFlexibleDims(initialDims);
                        }
                      }
                    } else if (!isFlexiblePkg && val) {
                      const newPkg = packages.find((p) => p.packageName === val);
                      const widths = newPkg ? Object.keys(newPkg.widths || {}) : [];
                      if (widths.length > 0 && newForm.tentWidth && !widths.includes(newForm.tentWidth)) {
                        newForm.tentWidth = "";
                      }
                      setFormData(newForm);
                      if (val && newForm.tentWidth && newForm.tentLength) {
                        handlePkgCalculate(val, newForm.tentWidth, newForm.tentLength, newForm.tentCount);
                      }
                    }
                  }}
                  className="form-control"
                >
                  <option value="">-- اختر الباقة --</option>
                  {(isFlexiblePkg ? flexiblePackages : packages).map((pkg) => (
                    <option key={pkg.packageName} value={pkg.packageName}>{pkg.packageName}</option>
                  ))}
                </select>
              </div>

              {/* Flexible: width dropdown (like tents) */}
              {isFlexiblePkg && flexibleWidthPkg && formData.packageUsed && (
                <>
                  <div className="form-group">
                    <label>العرض (متر) <span className="required">*</span></label>
                    <select value={selectedFlexWidth}
                      onChange={(e) => {
                        const w = e.target.value;
                        setSelectedFlexWidth(w);
                        setRentedItems([]);
                        setVarianceData(null);
                        setVarianceDecision(null);
                        if (w) handleFlexibleWidthCalculate(formData.packageUsed, w);
                      }}
                      className="form-control">
                      <option value="">-- اختر العرض --</option>
                      {(() => {
                        const pkg = flexiblePackages.find((p) => p.packageName === formData.packageUsed);
                        return pkg?.widths?.map((w) => <option key={w} value={w}>{w} متر</option>) || null;
                      })()}
                    </select>
                  </div>
                  {selectedFlexWidth && rentedItems.length > 0 && (
                    <div className="form-group full-width">
                      <p className="subtitle" style={{ color: "var(--gold)" }}>🎯 تم حساب كميات "{formData.packageUsed}" لعرض {selectedFlexWidth}م — يمكنك تعديل الكميات يدوياً</p>
                    </div>
                  )}
                </>
              )}

              {/* Flexible: dynamic dimension inputs (formula) */}
              {isFlexiblePkg && !flexibleWidthPkg && formData.packageUsed && (
                <>
                  {(() => {
                    const pkg = flexiblePackages.find((p) => p.packageName === formData.packageUsed);
                    if (!pkg || !pkg.dims) return null;
                    return pkg.dims.map((d) => (
                      <div className="form-group" key={d.dim}>
                        <label>{d.dim} (متر)</label>
                        <input type="number" className="form-control" min="0" step="0.1"
                          placeholder={`أدخل ${d.dim}...`}
                          value={flexibleDims[d.dim] ?? ""}
                          onChange={(e) => handleFlexibleDimChange(d.dim, e.target.value)} />
                      </div>
                    ));
                  })()}
                  {formData.packageUsed && rentedItems.length > 0 && (
                    <div className="form-group full-width">
                      <p className="subtitle" style={{ color: "var(--gold)" }}>🎯 تم حساب كميات "{formData.packageUsed}" — يمكنك تعديل الكميات يدوياً</p>
                    </div>
                  )}
                </>
              )}

              {/* Legacy tent: width + length + count */}
              {!isFlexiblePkg && (
                <>
                  <div className="form-group">
                    <label htmlFor="tentWidth">عرض الخيمة (متر)</label>
                    <select id="tentWidth" name="tentWidth" value={formData.tentWidth}
                      onChange={(e) => handleSizeChange("tentWidth", e.target.value)} className="form-control">
                      <option value="">-- اختر العرض --</option>
                      {(() => {
                        const pkg = packages.find((p) => p.packageName === formData.packageUsed);
                        const widths = pkg ? Object.keys(pkg.widths || {}).sort((a, b) => parseFloat(a) - parseFloat(b)) : [];
                        return widths.length > 0
                          ? widths.map((w) => (<option key={w} value={w}>{w} متر</option>))
                          : TENT_WIDTHS.map((w) => (<option key={w} value={w}>{w} متر</option>));
                      })()}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="tentLength">طول الخيمة (متر)</label>
                    <input type="number" id="tentLength" name="tentLength" value={formData.tentLength}
                      onChange={(e) => handleSizeChange("tentLength", e.target.value)} className="form-control" min="1" step="1" placeholder="أدخل الطول..." />
                  </div>
                  <div className="form-group">
                    <label htmlFor="tentCount">عدد الخيام</label>
                    <input type="number" id="tentCount" name="tentCount" value={formData.tentCount}
                      onChange={(e) => handleSizeChange("tentCount", e.target.value)} className="form-control" min="1" step="1" placeholder="1" />
                  </div>
                  {formData.packageUsed && formData.tentWidth && formData.tentLength && formData.tentCount && rentedItems.length > 0 && (
                    <div className="form-group full-width">
                      <p className="subtitle" style={{ color: "var(--gold)" }}>🎯 تم حساب كميات "{formData.packageUsed}" لعرض {formData.tentWidth}م وطول {formData.tentLength}م لعدد {formData.tentCount} خيام — يمكنك تعديل الكميات يدوياً</p>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* 4b. Hall-specific fields */}
          {behavior === "hall" && (
            <>
              <div className="form-group">
                <label htmlFor="eventType">نوع الفعالية</label>
                <select id="eventType" name="eventType" value={formData.eventType} onChange={handleInputChange} className="form-control">
                  <option value="">-- اختر نوع الفعالية --</option>
                  <option value="عرس">عرس</option>
                  <option value="غداء">غداء</option>
                  <option value="عشاء">عشاء</option>
                  <option value="عزاء">عزاء</option>
                  <option value="اجتماع">اجتماع</option>
                  <option value="محاضرة">محاضرة</option>
                  <option value="مناسبة عائلية">مناسبة عائلية</option>
                  <option value="أخرى">أخرى</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="shift">الفترة</label>
                <select id="shift" name="shift" value={formData.shift} onChange={handleInputChange} className="form-control">
                  <option value="">-- اختر الفترة --</option>
                  <option value="صباحي">صباحي</option>
                  <option value="مسائي">مسائي</option>
                  <option value="يوم كامل">يوم كامل</option>
                </select>
              </div>
            </>
          )}

          {/* 4c. Dynamic custom fields for this booking type */}
          {typeFieldsConfig.length > 0 && (
            <div className="form-group full-width dynamic-fields-section">
              <div className="section-title-row">
                <h3>📋 حقول إضافية</h3>
              </div>
              <div className="dynamic-fields-grid">
                {typeFieldsConfig.map((field) => {
                  const key = field.fieldKey;
                  const val = customFieldValues[key] ?? (field.fieldType === "checkbox" ? false : "");
                  const setVal = (newVal) => setCustomFieldValues((prev) => ({ ...prev, [key]: newVal }));

                  if (field.fieldType === "select") {
                    return (
                      <div className="form-group" key={key}>
                        <label>{field.fieldLabel}{field.required && <span className="required"> *</span>}</label>
                        <select value={val} onChange={(e) => setVal(e.target.value)} className="form-control" required={field.required}>
                          <option value="">-- اختر --</option>
                          {field.options.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                        </select>
                      </div>
                    );
                  }

                  if (field.fieldType === "checkbox") {
                    return (
                      <div className="form-group" key={key} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <input type="checkbox" id={`cf-${key}`} checked={!!val} onChange={(e) => setVal(e.target.checked)} style={{ width: "20px", height: "20px" }} />
                        <label htmlFor={`cf-${key}`} style={{ margin: 0 }}>{field.fieldLabel}{field.required && <span className="required"> *</span>}</label>
                      </div>
                    );
                  }

                  if (field.fieldType === "textarea") {
                    return (
                      <div className="form-group" key={key} style={{ gridColumn: "1 / -1" }}>
                        <label>{field.fieldLabel}{field.required && <span className="required"> *</span>}</label>
                        <textarea value={val} onChange={(e) => setVal(e.target.value)} className="form-control" rows="3" required={field.required} />
                      </div>
                    );
                  }

                  if (field.fieldType === "image") {
                    const uploadId = `upload-cf-${key}`;
                    return (
                      <div className="form-group" key={key} style={{ gridColumn: "1 / -1" }}>
                        <label>{field.fieldLabel}{field.required && <span className="required"> *</span>}</label>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                          <label htmlFor={uploadId} className="btn btn-sm btn-gold" style={{ cursor: detailMode === "view" ? "default" : "pointer", whiteSpace: "nowrap", opacity: detailMode === "view" ? 0.5 : 1 }}>
                            📁 رفع صورة
                          </label>
                          <input type="file" id={uploadId} accept="image/*" style={{ display: "none" }} disabled={detailMode === "view"} onChange={async (e) => {
                            if (detailMode === "view") return;
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const fd = new FormData();
                            fd.append("file", file);
                            try {
                              const res = await fetch("/api/upload", { method: "POST", body: fd });
                              const data = await res.json();
                              if (data.success) setVal(data.url);
                            } catch (err) { console.error("Upload failed", err); }
                          }} />
                          {val && (
                            <button type="button" className="btn btn-sm btn-ghost" onClick={() => { if (detailMode === "view") return; document.getElementById(uploadId).value = ""; setVal(""); }} disabled={detailMode === "view"} style={{ padding: "0.25rem 0.5rem" }}>❌</button>
                          )}
                        </div>
                        {val && (
                          <div style={{ marginTop: "0.5rem", borderRadius: "8px", overflow: "hidden", maxWidth: "200px", border: "1px solid rgba(255,255,255,0.1)" }}>
                            <img src={val} alt={field.fieldLabel} style={{ width: "100%", height: "auto", display: "block" }} onError={(e) => { e.target.style.display = "none"; e.target.parentElement.innerHTML = '<span style="color:red;font-size:0.8rem;padding:0.5rem;">⚠️ تعذر تحميل الصورة</span>'; }} />
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div className="form-group" key={key}>
                      <label>{field.fieldLabel}{field.required && <span className="required"> *</span>}</label>
                      <input type={field.fieldType} value={val} onChange={(e) => setVal(e.target.value)} className="form-control" required={field.required} placeholder={field.fieldLabel} {...(field.fieldType === "number" ? { min: "0", step: "0.01" } : {})} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. Rented Items — interactive table with deficit tracking */}
          {behavior !== "hall" && (
            <div className="form-group full-width" style={{ marginTop: "0.5rem" }}>
              <div className="rented-items-section">
                <div className="section-title-row">
                  <h3>🏷️ الأصناف المستأجرة</h3>
                  <button type="button" className="btn btn-sm btn-gold" onClick={addRentedItem} disabled={detailMode === "view"}>➕ إضافة صنف</button>
                </div>
                {rentedItems.length === 0 && behavior === "individual" && (
                  <p className="subtitle">أضف الأصناف التي سيتم تأجيرها لهذا الحجز</p>
                )}
                {rentedItems.length === 0 && behavior === "packages" && (
                  <p className="subtitle">اختر الباقة والمقاس لتظهر الأصناف تلقائياً، أو أضف أصنافاً إضافية يدوياً</p>
                )}

                {/* Calendar reconciliation warning */}
                {calendarWarnings.length > 0 && (
                  <div className="alert alert-warning" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "8px", padding: "0.75rem", marginBottom: "0.75rem" }}>
                    <strong style={{ color: "#f59e0b" }}>📅 تنبيه — يوجد حدث في التقويم غير مرتبط بحجز في قاعدة البيانات</strong>
                    {calendarWarnings.map((w, i) => (
                      <p key={i} style={{ color: "#f59e0b", margin: "0.5rem 0 0", fontSize: "0.9rem" }}>
                        • <strong>{w.eventTitle}</strong> — من {w.startDate} إلى {w.endDate}
                        {w.type === "بدون رقم حجز" ? " (بدون رقم حجز)" : ` (رقم ${w.bookingId} غير موجود في قاعدة البيانات)`}
                      </p>
                    ))}
                    <p style={{ color: "#f59e0b", margin: "0.5rem 0 0", fontSize: "0.85rem", opacity: 0.8 }}>
                      راجع التقويم للتأكد من عدم تعارض الحجز الجديد مع هذا الحدث.
                    </p>
                  </div>
                )}

                {/* Smart downsizing suggestion */}
                {maxPossibleLength !== null && formData.tentLength && parseFloat(formData.tentLength) > maxPossibleLength && (
                  <div className="alert alert-info" style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: "8px", padding: "0.75rem", marginBottom: "0.75rem" }}>
                    <strong style={{ color: "#3b82f6" }}>💡 اقتراح تصغير:</strong>
                    <p style={{ color: "#3b82f6", margin: "0.25rem 0", fontSize: "0.9rem" }}>
                      بناءً على المخزون المتاح في هذه التواريخ، أقصى مقاس يمكن حجزه لهذه الباقة هو خيمة بطول <strong>{maxPossibleLength} متر</strong>
                    </p>
                  </div>
                )}

                {rentedItems.length > 0 && (
                  <div className="inv-table-wrapper" style={{ marginTop: "0.75rem" }}>
                    <table className="inv-table" style={{ fontSize: "0.85rem" }}>
                      <thead>
                        <tr>
                          <th style={{ minWidth: "180px" }}>اسم الصنف</th>
                          <th style={{ width: "140px" }}>الكمية المطلوبة</th>
                          <th style={{ width: "90px" }}>سعر الوحدة</th>
                          <th style={{ width: "100px" }}>المتاح في المخزن</th>
                          <th style={{ width: "100px" }}>العجز / النقص</th>
                          <th style={{ width: "40px" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {rentedItems.map((item, idx) => {
                          const inv = invAvailability.length > 0
                            ? invAvailability.find((i) => i.itemId === item.itemId)
                            : invForRent.find((i) => i.itemId === item.itemId);
                          const available = inv ? inv.availableQuantity : 0;
                          const requested = Number(item.quantity) || 0;
                          const deficit = Math.max(0, requested - available);
                          return (
                            <tr key={idx}>
                              <td>
                                <select
                                  value={item.itemId}
                                  onChange={(e) => updateRentedItem(idx, "itemId", e.target.value)}
                                  className="form-control"
                                  style={{ fontSize: "0.85rem" }}
                                >
                                  <option value="">-- اختر صنف --</option>
                                  {invAvailability.length > 0
                                    ? invAvailability.map((inv2) => (
                                        <option key={inv2.itemId} value={inv2.itemId} style={inv2.availableQuantity <= 0 ? { color: "#dc2626" } : {}}>
                                          {inv2.itemName} ({inv2.availableQuantity >= 0 ? `متاح: ${inv2.availableQuantity}` : "غير متاح"})
                                        </option>
                                      ))
                                    : invForRent.map((inv2) => (
                                        <option key={inv2.itemId} value={inv2.itemId}>{inv2.itemName}</option>
                                      ))}
                                </select>
                                {varianceData && (() => {
                                  const m = varianceData.modified.find((x) => x.itemId === item.itemId);
                                  const a = varianceData.added.find((x) => x.itemId === item.itemId);
                                  if (m) return <span style={{ display:"inline-block", marginRight:"6px", fontSize:"0.75rem", padding:"2px 6px", borderRadius:"4px", background:"rgba(245,158,11,0.15)", color:"#d97706", fontWeight:"bold" }}>⚠️ كمية معدلة</span>;
                                  if (a) return <span style={{ display:"inline-block", marginRight:"6px", fontSize:"0.75rem", padding:"2px 6px", borderRadius:"4px", background:"rgba(59,130,246,0.15)", color:"#3b82f6", fontWeight:"bold" }}>➕ صنف مضاف/مستبدل</span>;
                                  return null;
                                })()}
                              </td>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                  <button
                                    type="button"
                                    className="btn-sm"
                                    style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", padding: "0.15rem 0.4rem" }}
                                    onClick={() => updateRentedItem(idx, "quantity", Math.max(0, requested - 1))}
                                    disabled={requested <= 0 || detailMode === "view"}
                                  >
                                    −
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    value={item.quantity}
                                    onChange={(e) => updateRentedItem(idx, "quantity", Math.max(0, Number(e.target.value)))}
                                    className="form-control"
                                    style={{ width: "60px", textAlign: "center", fontSize: "0.85rem", padding: "0.2rem" }}
                                  />
                                  <button
                                    type="button"
                                    className="btn-sm"
                                    style={{ background: "rgba(5,150,105,0.1)", color: "#059669", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", padding: "0.15rem 0.4rem" }}
                                    onClick={() => updateRentedItem(idx, "quantity", requested + 1)}
                                    disabled={detailMode === "view"}
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.unitPrice}
                                  onChange={(e) => updateRentedItem(idx, "unitPrice", e.target.value)}
                                  className="form-control"
                                  style={{ width: "80px", textAlign: "center", fontSize: "0.85rem", padding: "0.2rem" }}
                                  placeholder="0"
                                />
                              </td>
                              <td style={{ textAlign: "center", fontWeight: "bold", color: available > 0 ? "#059669" : "#dc2626" }}>
                                {available}
                              </td>
                              <td style={{ textAlign: "center", fontWeight: "bold", color: deficit > 0 ? "#dc2626" : "#059669" }}>
                                {deficit > 0 ? `عجز ${deficit}` : "✅ 0"}
                              </td>
                              <td>
                                <button type="button" className="btn-remove" onClick={() => removeRentedItem(idx)} disabled={detailMode === "view"} style={{ fontSize: "0.75rem" }}>✕</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Variance Detection Report — only shows during edit when diff detected */}
              {editBookingId && varianceData && (
                <div style={{ marginTop:"1rem", padding:"0.75rem", background:"rgba(139,92,246,0.08)", border:"1px solid rgba(139,92,246,0.2)", borderRadius:"8px" }}>
                  <h4 style={{ margin:"0 0 0.5rem", color:"#8b5cf6", fontSize:"0.95rem" }}>📊 تقرير التخصيص اليدوي للباقة</h4>
                  {varianceData.deleted.length > 0 && (
                    <div style={{ marginBottom:"0.5rem" }}>
                      <strong style={{ fontSize:"0.85rem", color:"#dc2626" }}>🗑️ الأصناف المحذوفة (موجودة في الباقة الأصلية لكن تم حذفها):</strong>
                      <ul style={{ margin:"0.25rem 0 0", padding:"0 1rem", fontSize:"0.85rem" }}>
                        {varianceData.deleted.map((d, i) => (
                          <li key={i} style={{ color:"#dc2626", margin:"2px 0" }}>{d.itemName} — (الكمية الأصلية: {d.standardQty})</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {varianceData.modified.length > 0 && (
                    <div style={{ marginBottom:"0.5rem" }}>
                      <strong style={{ fontSize:"0.85rem", color:"#d97706" }}>⚠️ الكميات المعدلة:</strong>
                      <ul style={{ margin:"0.25rem 0 0", padding:"0 1rem", fontSize:"0.85rem" }}>
                        {varianceData.modified.map((m, i) => (
                          <li key={i} style={{ color:"#d97706", margin:"2px 0" }}>{m.itemName} — المحفوظ: {m.savedQty} | الأصلي: {m.standardQty}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {varianceData.added.length > 0 && (
                    <div style={{ marginBottom:"0.5rem" }}>
                      <strong style={{ fontSize:"0.85rem", color:"#3b82f6" }}>➕ الأصناف المضافة/المستبدلة:</strong>
                      <ul style={{ margin:"0.25rem 0 0", padding:"0 1rem", fontSize:"0.85rem" }}>
                        {varianceData.added.map((a, i) => (
                          <li key={i} style={{ color:"#3b82f6", margin:"2px 0" }}>{a.itemName} — (الكمية: {a.savedQty})</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div style={{ display:"flex", gap:"0.5rem", marginTop:"0.75rem", flexWrap:"wrap" }}>
                    <button type="button" className="btn btn-primary" style={{ fontSize:"0.85rem" }} onClick={() => { setVarianceDecision("keep"); setVarianceData(null); }}>
                      ✅ اعتماد واستمرار التعديل السابق
                    </button>
                    <button type="button" className="btn btn-gold" style={{ fontSize:"0.85rem" }} onClick={() => {
                      setVarianceDecision("recalculate");
                      setVarianceData(null);
                      if (formData.packageUsed && formData.tentWidth && formData.tentLength) {
                        handlePkgCalculate(formData.packageUsed, formData.tentWidth, formData.tentLength, formData.tentCount);
                      }
                    }}>
                      🔄 إعادة الحسبة وتطبيق الباقة الأصلية
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 6. Individual item rental fields — pricing, transport, deposit */}
          {behavior === "individual" && (
            <div className="form-group full-width individual-rental-section">
              <div className="section-title-row" style={{ marginBottom: "0.75rem" }}>
                <h3 style={{ fontSize: "1.1rem", margin: 0 }}>🧾 تفاصيل التأجير</h3>
              </div>

              <div className="form-group" style={{ marginBottom: "0.75rem" }}>
                <label>نوع التسعير</label>
                <div className="radio-group">
                  <label className={`radio-label ${pricingType === "تفصيلي بالصنف" ? "active" : ""}`}>
                    <input type="radio" name="pricingType" value="تفصيلي بالصنف" checked={pricingType === "تفصيلي بالصنف"} onChange={(e) => setPricingType(e.target.value)} />
                    تفصيلي بالصنف
                  </label>
                  <label className={`radio-label ${pricingType === "مبلغ شامل مقطوع" ? "active" : ""}`}>
                    <input type="radio" name="pricingType" value="مبلغ شامل مقطوع" checked={pricingType === "مبلغ شامل مقطوع"} onChange={(e) => setPricingType(e.target.value)} />
                    مبلغ شامل مقطوع
                  </label>
                </div>
              </div>

              {pricingType === "مبلغ شامل مقطوع" && (
                <div className="form-group" style={{ marginBottom: "0.75rem" }}>
                  <label>السعر الأساسي (ريال)</label>
                  <input type="number" min="0" step="0.01" value={manualBasePrice} onChange={(e) => setManualBasePrice(e.target.value)} placeholder="أدخل المبلغ الإجمالي" className="form-control" />
                </div>
              )}

              <div className="form-group" style={{ marginBottom: "0.75rem" }}>
                <label>تكاليف النقل</label>
                <div className="radio-group">
                  <label className={`radio-label ${transResponsibility === "علينا (شاملة في المبلغ)" ? "active" : ""}`}>
                    <input type="radio" name="transResponsibility" value="علينا (شاملة في المبلغ)" checked={transResponsibility === "علينا (شاملة في المبلغ)"} onChange={(e) => { setTransResponsibility(e.target.value); setTransCost(""); }} />
                    علينا (شاملة في المبلغ)
                  </label>
                  <label className={`radio-label ${transResponsibility === "على الزبون" ? "active" : ""}`}>
                    <input type="radio" name="transResponsibility" value="على الزبون" checked={transResponsibility === "على الزبون"} onChange={(e) => setTransResponsibility(e.target.value)} />
                    على الزبون
                  </label>
                </div>
                {transResponsibility === "على الزبون" && (
                  <div style={{ marginTop: "0.5rem" }}>
                    <label>مبلغ النقل (ريال)</label>
                    <input type="number" min="0" step="0.01" value={transCost} onChange={(e) => setTransCost(e.target.value)} placeholder="أدخل مبلغ النقل" className="form-control" style={{ maxWidth: "200px" }} />
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: "0.75rem" }}>
                <label>نوع الضمان</label>
                <select value={depositType} onChange={(e) => setDepositType(e.target.value)} className="form-control" style={{ maxWidth: "300px" }}>
                  <option value="مبلغ تأمين نقدي">مبلغ تأمين نقدي</option>
                  <option value="ضمانة شخصية">ضمانة شخصية</option>
                </select>
              </div>

              {depositType === "مبلغ تأمين نقدي" && (
                <div className="form-group" style={{ marginBottom: "0.75rem" }}>
                  <label>مبلغ التأمين (ريال)</label>
                  <input type="number" min="0" step="0.01" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="أدخل مبلغ التأمين" className="form-control" style={{ maxWidth: "200px" }} />
                </div>
              )}

              {depositType === "ضمانة شخصية" && (
                <div className="guarantor-fields" style={{ marginBottom: "0.75rem" }}>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold", color: "var(--primary)" }}>بيانات الضامن</label>
                  <div className="guarantor-grid">
                    <input type="text" value={guarantorName} onChange={(e) => setGuarantorName(e.target.value)} placeholder="اسم الضامن بالكامل *" className="form-control" required />
                    <input type="text" value={guarantorPhone} onChange={(e) => setGuarantorPhone(e.target.value)} placeholder="رقم جوال الضامن *" className="form-control" required />
                    <input type="text" value={guarantorId} onChange={(e) => setGuarantorId(e.target.value)} placeholder="رقم الهوية/البطاقة" className="form-control" />
                  </div>
                  <div style={{ marginTop: "0.5rem" }}>
                    <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.3rem", opacity: 0.8 }}>صورة بطاقة الضامن</label>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <label htmlFor="upload-guarantor-id" className="btn btn-sm btn-gold" style={{ cursor: detailMode === "view" ? "default" : "pointer", whiteSpace: "nowrap", opacity: detailMode === "view" ? 0.5 : 1 }}>
                        📁 رفع صورة
                      </label>
                      <input type="file" id="upload-guarantor-id" accept="image/*" style={{ display: "none" }} disabled={detailMode === "view"} onChange={async (e) => {
                        if (detailMode === "view") return;
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const fd = new FormData();
                        fd.append("file", file);
                        try {
                          const res = await fetch("/api/upload", { method: "POST", body: fd });
                          const data = await res.json();
                          if (data.success) setGuarantorIdPhoto(data.url);
                        } catch (err) { console.error("Upload failed", err); }
                      }} />
                      {guarantorIdPhoto && (
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => { if (detailMode === "view") return; document.getElementById("upload-guarantor-id").value = ""; setGuarantorIdPhoto(""); }} disabled={detailMode === "view"} style={{ padding: "0.25rem 0.5rem" }}>❌</button>
                      )}
                    </div>
                    {guarantorIdPhoto && (
                      <div style={{ marginTop: "0.5rem", borderRadius: "8px", overflow: "hidden", maxWidth: "120px", border: "1px solid rgba(255,255,255,0.1)" }}>
                        <img src={guarantorIdPhoto} alt="بطاقة الضامن" style={{ width: "100%", height: "auto", display: "block" }} onError={(e) => { e.target.style.display = "none"; }} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="computed-total-box">
                <span className="computed-total-label">إجمالي سعر الإيجار النهائي:</span>
                <span className="computed-total-value">{formatCurrency(parseFloat(formData.totalAmount) || 0)}</span>
              </div>
            </div>
          )}

          {/* 7. Total + Paid */}
          <div className="form-group">
            <label htmlFor="totalAmount">إجمالي المبلغ (ريال)</label>
            <input type="number" id="totalAmount" name="totalAmount" value={formData.totalAmount} onChange={(e) => { if (behavior !== "individual") setFormData((prev) => ({ ...prev, totalAmount: e.target.value })); }} placeholder="مثال: 5000" className="form-control" disabled={behavior === "individual"} />
          </div>
          <div className="form-group">
            <label htmlFor="paidAmount">المبلغ المدفوع (مقدم)</label>
            <input
              type="number"
              id="paidAmount"
              name="paidAmount"
              value={formData.paidAmount}
              onChange={(e) => {
                const val = e.target.value;
                const paid = parseFloat(val) || 0;
                setFormData((prev) => ({
                  ...prev, paidAmount: val,
                  status: prev.status === "مؤكد" ? "مؤكد" : paid > 0 ? "مؤكد" : "قيد الانتظار",
                }));
              }}
              placeholder="مثال: 2000"
              className="form-control"
            />
            {(!formData.paidAmount || parseFloat(formData.paidAmount) <= 0) && (
              <small className="field-hint" style={{ color: "var(--gold)", display: "block", marginTop: "0.25rem" }}>
                ⏳ لم يتم إدخال مقدم — سيتم حفظ الحجز كـ <strong>قيد الانتظار</strong> ولن تخصم الكميات من المخزون
              </small>
            )}
            {formData.paidAmount && parseFloat(formData.paidAmount) > 0 && (
              <small className="field-hint" style={{ color: "#059669", display: "block", marginTop: "0.25rem" }}>
                ✅ تم إدخال مقدم — سيتم تأكيد الحجز وخصم الكميات من المخزون
              </small>
            )}
          </div>
          <div className="form-group">
            <label>🏦 الخزينة المستلمة</label>
            <select className="form-control" value={formData.cashAccountCode} onChange={(e) => setFormData((prev) => ({ ...prev, cashAccountCode: e.target.value }))}>
              <option value="1101">💰 صندوق الصالة</option>
              <option value="1102">📱 محفظة كريمي</option>
              <option value="1103">📱 محفظة جوالي</option>
              <option value="1104">📱 محفظة جيب</option>
            </select>
          </div>
          <div className="form-group">
            <label>🏢 الفرع</label>
            <select className="form-control" value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
              {branches.map(b => (
                <option key={b.code} value={b.code}>{b.name}</option>
              ))}
              {branches.length === 0 && <option value="DHM">ذمار</option>}
            </select>
          </div>
          <div className="form-group">
            <label>🏷️ مركز التكلفة</label>
            <select className="form-control" value={selectedCostCenter} onChange={(e) => setSelectedCostCenter(e.target.value)}>
              <option value="">— بدون —</option>
              {bookingCostCenters.filter(c => c.code.startsWith(`CC-${selectedBranch}`)).map(c => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group full-width">
            <label>حالة الحجز</label>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <span
                className="status-badge"
                style={{
                  padding: "0.4rem 1rem",
                  borderRadius: "8px",
                  fontWeight: "bold",
                  fontSize: "0.95rem",
                  background: formData.status === "مؤكد" ? "rgba(5,150,105,0.15)" : "rgba(245,158,11,0.15)",
                  color: formData.status === "مؤكد" ? "#059669" : "#d97706",
                }}
              >
                {formData.status === "مؤكد" ? "✅ مؤكد (سيتم خصم المخزون)" : "⏳ قيد الانتظار (لن تخصم الكميات)"}
              </span>
            </div>
          </div>

          <div className="form-group full-width">
            <label htmlFor="notes">ملاحظات إضافية</label>
            <textarea id="notes" name="notes" value={formData.notes} onChange={handleInputChange} placeholder="أي ملاحظات إضافية عن الحجز..." className="form-control" rows="2" />
          </div>
        </div>

        {hallConflictsList.length > 0 && (behavior === "hall" || hallConflict) && (
          <div className={`alert ${hallConflict ? "alert-danger" : "alert-warning"}`} style={{ background: hallConflict ? "rgba(220,38,38,0.1)" : "rgba(245,158,11,0.1)", border: hallConflict ? "1px solid rgba(220,38,38,0.3)" : "1px solid rgba(245,158,11,0.3)", borderRadius: "8px", padding: "0.75rem", marginBottom: "0.75rem" }}>
            <strong style={{ color: hallConflict ? "#dc2626" : "#d97706" }}>
              {hallConflict && behavior === "hall" && formData.bookingType?.includes("حوش")
                ? "⛔ الحوش محجوز في هذه الفترة — لا يمكن تكرار الحجز"
                : hallConflict && behavior === "hall"
                ? "⛔ الصالة محجوزة في هذه الفترة — لا يمكن تكرار الحجز"
                : "📋 الحجوزات الحالية في نفس التاريخ"}
            </strong>
            <div style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
              {hallConflictsList.map((b, i) => (
                <div key={i} style={{ marginBottom: "0.3rem", padding: "0.25rem 0", borderBottom: i < hallConflictsList.length - 1 ? "1px solid rgba(255,255,255,0.1)" : "none" }}>
                  <span style={{ fontWeight: "bold" }}>{b.customerName}</span>
                  {" — "}
                  <span>{b.bookingType}</span>
                  {b.shift && <span> — <strong>{b.shift === "صباحي" ? "🌅 نهاري" : b.shift === "مسائي" ? "🌙 ليلي" : "☀️🌙 يوم كامل"}</strong></span>}
                  {b.eventType && <span> ({b.eventType})</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {hallWarning && (
          <div className="modal-overlay" style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.5)" }}>
            <div className="modal-content" style={{ maxWidth: "500px", textAlign: "center", padding: "2rem" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
              <h3 style={{ color: "#d97706", marginBottom: "0.75rem" }}>تنبيه: يوجد حجز للصالة في هذه التواريخ</h3>
              <p style={{ marginBottom: "0.5rem", color: "#444" }}>الرجاء التأكد قبل إتمام الحجز — الصالة محجوزة في التواريخ التالية:</p>
              <div style={{ background: "#fef3c7", borderRadius: "8px", padding: "0.75rem", marginBottom: "1rem", fontSize: "0.85rem" }}>
                {hallConflictsList.map((c, i) => (
                  <div key={i} style={{ marginBottom: i < hallConflictsList.length - 1 ? "0.5rem" : 0 }}>
                    <strong>{c.customerName}</strong> — {c.startDate} → {c.endDate}
                    {c.shift && <span> ({c.shift})</span>}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                <button onClick={confirmHallOverride} className="btn btn-primary" style={{ padding: "0.75rem 1.5rem" }}>✅ متابعة الحجز</button>
                <button onClick={cancelHallOverride} className="btn btn-gold" style={{ padding: "0.75rem 1.5rem" }}>🔙 مراجعة التواريخ</button>
              </div>
            </div>
          </div>
        )}

        </fieldset>

        {/* Bottom Action Bar for detail view/edit modes */}
        {detailMode !== null && (
          <div className="detail-action-bar">
            {detailMode === "edit" && (
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
                style={{ flex:1, padding:"0.75rem 1rem", fontSize:"1rem", fontWeight:"bold" }}
              >
                {submitting ? <> <div className="mini-spinner"></div> جاري الحفظ... </> : "💾 حفظ التعديلات"}
              </button>
            )}
            <button type="button" className="btn btn-gold" onClick={() => { if (detailBooking) handlePrint(detailBooking); }} style={{ flex:1, padding:"0.75rem 1rem", fontSize:"1rem" }}>
              🖨️ طباعة
            </button>
            {detailMode === "view" && (
              <button type="button" className="btn btn-primary" onClick={() => setDetailMode("edit")} style={{ flex:1, padding:"0.75rem 1rem", fontSize:"1rem", fontWeight:"bold" }}>
                ✏️ تعديل
              </button>
            )}
            {detailBooking && (() => {
              const countryCode = process.env.NEXT_PUBLIC_DEFAULT_COUNTRY_CODE || '966';
              const phone = countryCode + (detailBooking.customerPhone || "").replace(/^0/, '').replace(/[^0-9]/g, '');
              const msg = fillTemplate(detailBooking);
              return (
                <a href={`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer" className="btn btn-success" style={{ flex:1, padding:"0.75rem 1rem", fontSize:"1rem", textDecoration:"none", textAlign:"center" }}>
                  💬 واتساب
                </a>
              );
            })()}
            <button type="button" className="btn btn-secondary" onClick={() => { setDetailMode(null); setDetailBooking(null); setEditBookingId(null); setVarianceData(null); setVarianceDecision(null); setView("query"); }} style={{ flex:1, padding:"0.75rem 1rem", fontSize:"1rem" }}>
              🔙 رجوع
            </button>
          </div>
        )}

        {detailMode === null && (
        <div className="form-actions">
          {(() => {
            const hasDeficit = invAvailability.length > 0 && rentedItems.some((item) => {
              if (!item.itemId || !item.quantity) return false;
              const inv = invAvailability.find((i) => i.itemId === item.itemId);
              const available = inv ? inv.availableQuantity : 0;
              return (Number(item.quantity) || 0) > available;
            });
            return (
              <>
                <button
                  type="submit"
                  disabled={submitting || hasDeficit || (behavior === "hall" && hallConflict)}
                  className="btn btn-primary submit-btn"
                  title={hasDeficit ? "يوجد عجز في المخزون — قم بتعديل الكميات أولاً" : behavior === "hall" && hallConflict ? "الصالة محجوزة في هذه التواريخ" : ""}
                >
                  {submitting ? <> <div className="mini-spinner"></div> جاري الحفظ... </> : hasDeficit ? "⛔ يوجد عجز في المخزون" : behavior === "hall" && hallConflict ? "⛔ الصالة محجوزة" : editBookingId ? "💾 حفظ التعديلات" : "تأكيد الحجز وحفظ البيانات"}
                </button>
                <button type="button" onClick={() => { setEditBookingId(null); setVarianceData(null); setVarianceDecision(null); setView("query"); }} className="btn btn-gold">إلغاء</button>
              </>
            );
          })()}
        </div>
        )}
      </form>
    </section>
  );
}
