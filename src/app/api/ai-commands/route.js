import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sheets } from "@/lib/google";
import { getFinanceLedger, addFinanceEntry, getChartOfAccounts } from "@/lib/sheets";
import nodemailer from "nodemailer";
import jsPDF from "jspdf";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const EPSON_EMAIL = "hwy80305686jqg@print.epsonconnect.com";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

async function fetchBookings(query) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Bookings!A:O",
  });
  const rows = (res.data.values || []).slice(1).filter(r => r[0]);
  if (!query) return rows.map(r => ({ bookingId: r[0], customerName: r[1] || "", customerPhone: r[2] || "", customerAddress: r[3] || "", startDate: r[4] || "", endDate: r[5] || "", totalAmount: parseFloat(r[6] || 0), paidAmount: parseFloat(r[7] || 0), remainingAmount: parseFloat(r[8] || 0), status: r[9] || "", bookingType: r[10] || "", notes: r[11] || "" }));
  const q = query.toLowerCase().replace(/\s+/g, " ").trim();
  const qWords = q.split(" ").filter(Boolean);
  const mapped = rows.map(r => {
    const name = (r[1] || "").toLowerCase().replace(/\s+/g, " ").trim();
    const id = (r[0] || "").trim();
    const exact = name === q;
    const partial = name.includes(q);
    const wordMatches = qWords.filter(w => name.includes(w)).length;
    const idMatch = id === q ? 998 : 0;
    return { score: Math.max(idMatch, exact ? 999 : partial ? 500 + wordMatches : wordMatches), bookingId: id, customerName: r[1] || "", customerPhone: r[2] || "", customerAddress: r[3] || "", startDate: r[4] || "", endDate: r[5] || "", totalAmount: parseFloat(r[6] || 0), paidAmount: parseFloat(r[7] || 0), remainingAmount: parseFloat(r[8] || 0), status: r[9] || "", bookingType: r[10] || "", notes: r[11] || "", };
  });
  return mapped.filter(b => b.score > 0).sort((a, b) => b.score - a.score);
}

async function generateStatementPdf(bookingId) {
  const bookings = await fetchBookings(bookingId);
  const booking = bookings[0];
  if (!booking) throw new Error("الحجز غير موجود");

  const entries = await getFinanceLedger("", "", "", 0);
  const bookingEntries = entries.filter(e => e.linkedBookingId === bookingId);

  const doc = new jsPDF({ format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  const pageCenter = pageW / 2;
  doc.setFontSize(18);
  doc.text(booking.customerName || "كشف حساب", pageCenter, y, { align: "center" });
  y += 12;
  doc.setFontSize(11);
  doc.text(`رقم الحجز: ${booking.bookingId}`, 20, y);
  y += 7;
  doc.text(`الحالة: ${booking.status}`, 20, y);
  y += 7;
  doc.text(`التاريخ: ${booking.startDate} - ${booking.endDate}`, 20, y);
  y += 12;

  doc.setFontSize(10);
  doc.text("البيان", 20, y);
  doc.text("المبلغ", 120, y);
  doc.text("النوع", 160, y);
  doc.text("التاريخ", 190, y);
  y += 6;
  doc.line(20, y, pageW - 20, y);
  y += 6;

  for (const e of bookingEntries) {
    doc.text(e.notes?.slice(0, 40) || "—", 20, y);
    doc.text(e.amount.toLocaleString(), 120, y);
    doc.text(e.entryType === "income" ? "ايراد" : e.entryType === "expense" ? "مصروف" : e.entryType, 160, y);
    doc.text(e.date, 190, y);
    y += 7;
    if (y > 280) { doc.addPage(); y = 20; }
  }

  y += 6;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  const totalPaid = bookingEntries.filter(e => e.entryType === "income").reduce((s, e) => s + e.amount, 0);
  doc.text(`الإجمالي المدفوع: ${totalPaid.toLocaleString()} ريال`, 20, y);
  y += 8;
  doc.text(`المتبقي: ${booking.remainingAmount.toLocaleString()} ريال`, 20, y);

  return Buffer.from(doc.output("arraybuffer"));
}

export async function POST(request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    const { command, bookingId, customerName, amount, date, notes, cashAccountCode, bookingType, supplierName } = await request.json();

    if (!command) {
      return NextResponse.json({ success: false, error: "الحقل command مطلوب" }, { status: 400 });
    }

    switch (command) {

      case "print_statement": {
        if (!bookingId && !customerName) {
          return NextResponse.json({ success: false, error: "bookingId أو customerName مطلوب للطباعة" }, { status: 400 });
        }
        let targetBookingId = bookingId;
        if (!targetBookingId && customerName) {
          const bookings = await fetchBookings(customerName);
          if (bookings.length === 0) return NextResponse.json({ success: false, error: "لا توجد حجوزات لهذا العميل" }, { status: 404 });
          targetBookingId = bookings[0].bookingId;
        }

        const pdfBuffer = await generateStatementPdf(targetBookingId);

        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: EPSON_EMAIL,
          subject: "كشف حساب - " + (customerName || bookingId),
          text: "كشف حساب من نظام هابي لاند",
          attachments: [{ filename: `statement_${targetBookingId}.pdf`, content: pdfBuffer }],
        });

        return NextResponse.json({ success: true, message: "تم إرسال كشف الحساب للطابعة" });
      }

      case "add_payment": {
        if (!customerName && !bookingId) {
          return NextResponse.json({ success: false, error: "اسم العميل أو رقم الحجز مطلوب" }, { status: 400 });
        }
        const amt = parseFloat(amount);
        if (!amt || amt <= 0) {
          return NextResponse.json({ success: false, error: "المبلغ مطلوب ويجب أن يكون أكبر من 0" }, { status: 400 });
        }

        let targetBookingId = bookingId;
        if (!targetBookingId && customerName) {
          const bookings = await fetchBookings(customerName);
          if (bookings.length === 0) return NextResponse.json({ success: false, error: "لا توجد حجوزات لهذا العميل" }, { status: 404 });
          targetBookingId = bookings[0].bookingId;
        }

        const entryDate = date || new Date().toLocaleDateString("en-CA");
        const accounts = await getChartOfAccounts(false);
        const incomeAcct = accounts.find(a => a.linkedBookingType);
        const accountCode = incomeAcct?.accountCode || "4101";

        await addFinanceEntry({
          date: entryDate,
          accountCode,
          entryType: "income",
          amount: amt,
          linkedBookingId: targetBookingId,
          notes: notes || `دفعة من ${customerName || bookingId}`,
          cashAccountCode: cashAccountCode || "1101",
          branch: "DHM",
        });

        return NextResponse.json({ success: true, message: `تم إضافة دفعة بقيمة ${amt.toLocaleString()} ريال للحجز ${targetBookingId}` });
      }

      case "check_availability": {
        if (!date) {
          return NextResponse.json({ success: false, error: "التاريخ مطلوب لفحص الإتاحة" }, { status: 400 });
        }
        const bookRes = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: "Bookings!A:O",
        });
        const allRows = (bookRes.data.values || []).slice(1).filter(r => r[0]);
        const conflicting = allRows.filter(r => {
          const s = r[4] || "", e = r[5] || "", st = (r[9] || "").trim();
          if (st === "ملغي") return false;
          if (bookingType && (r[10] || "").trim() !== bookingType.trim()) return false;
          if (date >= s && date <= e) return true;
          if (date <= e && date >= s) return true;
          return false;
        });
        if (conflicting.length === 0) {
          return NextResponse.json({ success: true, message: `✅ التاريخ ${date} متاح${bookingType ? ` لنوع "${bookingType}"` : ""}` });
        }
        const details = conflicting.map(r => `${r[1] || "عميل"} (${r[4]} - ${r[5]})`).join("، ");
        return NextResponse.json({ success: true, message: `⚠️ التاريخ ${date} غير متاح بالكامل. توجد حجوزات: ${details}` });
      }

      case "get_supplier_balance": {
        if (!supplierName) {
          return NextResponse.json({ success: false, error: "اسم المورد مطلوب" }, { status: 400 });
        }
        const supRes = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: "Suppliers!A:G",
        });
        const supRows = (supRes.data.values || []).slice(1).filter(r => r[0]);
        const q = supplierName.toLowerCase();
        const matched = supRows.find(r => (r[1] || "").toLowerCase().includes(q));
        if (!matched) {
          return NextResponse.json({ success: false, error: `المورد "${supplierName}" غير موجود` });
        }
        return NextResponse.json({
          success: true,
          message: `المورد: ${matched[1]}\nرقم الجوال: ${matched[2] || "غير مسجل"}\nالرصيد المستحق: ${parseFloat(matched[4] || 0).toLocaleString()} ريال`,
        });
      }

      default:
        return NextResponse.json({ success: false, error: `أمر غير معروف: ${command}` }, { status: 400 });
    }
  } catch (error) {
    console.error("POST /api/ai-commands error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}