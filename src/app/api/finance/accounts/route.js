import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";
import { getChartOfAccounts, addAccount, getSheetData } from "@/lib/sheets";
import { requireAuth } from "@/lib/auth";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

async function ensureSheet() {
  try {
    await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Chart_Of_Accounts!A1",
    });
  } catch {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: "Chart_Of_Accounts" } } }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: "Chart_Of_Accounts!A1",
      valueInputOption: "RAW",
      requestBody: {
        values: [["AccountCode", "AccountName", "AccountType", "ParentCode", "LinkedBookingType", "IsActive", "CostCenterCode", "LessorName", "LessorPhone"]],
      },
    });
    const defaultAccounts = [
      ["1100", "النقدية والأرصدة لدى البنوك", "asset", "", "", "TRUE", ""],
      ["1101", "الصندوق الرئيسي", "asset", "1100", "", "TRUE", ""],
      ["1102", "محفظة كريمي", "asset", "1100", "", "TRUE", ""],
      ["1103", "محفظة جوالي", "asset", "1100", "", "TRUE", ""],
      ["1104", "محفظة جيب", "asset", "1100", "", "TRUE", ""],
      ["1200", "مخزون مستودع", "asset", "", "", "TRUE", ""],
      ["1202", "ذمم مدينة - عملاء", "asset", "", "", "TRUE", ""],
      ["1300", "شراء وتصنيع اصول (تحت الإنشاء)", "asset", "", "", "TRUE", ""],
      ["1301", "حديد ومواد خام اصول", "asset", "1300", "", "TRUE", ""],
      ["1302", "أجور لحام وتصنيع اصول", "asset", "1300", "", "TRUE", ""],
      ["4001", "إيرادات التأجير", "income", "", "", "TRUE", ""],
      ["4001-01", "إيرادات تأجير الصالة", "income", "4001", "حجوزات الصالة هابي لاند", "TRUE", ""],
      ["4001-02", "إيرادات تأجير المخيمات", "income", "4001", "حجوزات الخيام", "TRUE", ""],
      ["4001-03", "ايرادات الكوش", "income", "4001", "", "TRUE", ""],
      ["4001-04", "ايرادات تأجير المفردات", "income", "4001", "", "TRUE", ""],
      ["4005", "إيرادات إيجارات", "income", "", "", "TRUE", ""],
      ["4005-01", "إيجار البيت", "income", "4005", "", "TRUE", ""],
      ["2100", "مطلوبات متداولة", "liability", "", "", "TRUE", ""],
      ["2101", "موردون", "liability", "2100", "", "TRUE", ""],
      ["2102", "قروض", "liability", "2100", "", "TRUE", ""],
      ["2103", "مستحقات", "liability", "2100", "", "TRUE", ""],
      ["2104", "رواتب مستحقة", "liability", "2100", "", "TRUE", ""],
      ["2300", "عربون حجوزات", "liability", "", "", "TRUE", ""],
      ["2200", "حقوق ملكية", "equity", "", "", "TRUE", ""],
      ["2201", "رأس المال", "equity", "2200", "", "TRUE", ""],
      ["2202", "أرباح مبقاة", "equity", "2200", "", "TRUE", ""],
      ["2203", "مسحوبات المالك", "equity", "2200", "", "TRUE", ""],
      ["2203-01", "مصاريف شخصية", "equity", "2203", "", "TRUE", ""],
      ["2203-02", "مساعدات عائلية", "equity", "2203", "", "TRUE", ""],
      ["2203-03", "صدقات وتبرعات", "equity", "2203", "", "TRUE", ""],
      ["2203-04", "نثريات وأخرى", "equity", "2203", "", "TRUE", ""],
      ["5001", "كهرباء", "expense", "", "", "TRUE", ""],
      ["5001-01", "كهرباء الصالة", "expense", "5001", "حجوزات الصالة هابي لاند", "TRUE", ""],
      ["5001-01-01", "كهرباء الصالة - حكومي", "expense", "5001-01", "", "TRUE", ""],
      ["5001-01-02", "كهرباء الصالة - مولد جعفر", "expense", "5001-01", "", "TRUE", ""],
      ["5001-01-03", "كهرباء الصالة - مولد الصمود", "expense", "5001-01", "", "TRUE", ""],
      ["5001-02", "كهرباء الورشة", "expense", "5001", "حجوزات الخيام", "TRUE", ""],
      ["5001-03", "كهرباء المكتب", "expense", "5001", "", "TRUE", "CC-DHM-OFFICE"],
      ["5002", "نقل", "expense", "", "", "TRUE", ""],
      ["5003", "صيانة", "expense", "", "", "TRUE", ""],
      ["5003-01", "صيانة الخيام", "expense", "5003", "", "TRUE", "CC-DHM-TENTS"],
      ["5003-02", "صيانة الصالة", "expense", "5003", "", "TRUE", "CC-DHM-HALL"],
      ["5004", "رواتب", "expense", "", "", "TRUE", ""],
      ["5004-01", "رواتب العمال", "expense", "5004", "", "TRUE", "CC-DHM-ADMIN"],
      ["5004-02", "اتصالات وإنترنت", "expense", "5008", "", "TRUE", ""],
      ["5005", "إيجار", "expense", "", "", "TRUE", ""],
      ["5005-01", "إيجار الصالة والمكتب", "expense", "5005", "", "TRUE", ""],
      ["5005-02", "إيجار المخزن", "expense", "5005", "", "TRUE", ""],
      ["5006", "قرطاسية", "expense", "", "", "TRUE", ""],
      ["5006-01", "مصاريف نثرية", "expense", "5006", "", "TRUE", ""],
      ["5007", "تحويلات داخلية", "expense", "", "", "TRUE", ""],
      ["5008", "رخص وتصاريح", "expense", "", "", "TRUE", ""],
      ["5008-01", "رخص وتصاريح", "expense", "5008", "", "TRUE", "CC-DHM-OFFICE"],
      ["5008-02", "اتصالات وإنترنت", "expense", "5008", "", "TRUE", "CC-DHM-OFFICE"],
      ["5009", "صيانة وتجديد الأصول", "expense", "", "", "TRUE", ""],
      ["5009-01", "صيانة خيام (مصروف)", "expense", "5009", "", "TRUE", ""],
      ["5009-02", "صيانة صالة (مصروف)", "expense", "5009", "", "TRUE", ""],
      ["5009-04", "قطع غيار ومواد صيانة", "expense", "5009", "", "TRUE", ""],
      ["5011", "دعاية وإعلان", "expense", "", "", "TRUE", ""],
      ["5012", "قرطاسية وطباعة", "expense", "", "", "TRUE", ""],
      ["5013", "صيانة مواتر", "expense", "", "", "TRUE", ""],
      ["5014", "استهلاك أصول", "expense", "", "", "TRUE", ""],
      ["5100", "تكاليف ميدانية", "expense", "", "", "TRUE", ""],
      ["5101", "تكاليف التجهيز والتحميل", "expense", "5100", "", "TRUE", ""],
      ["5101-01", "أجور تحميل", "expense", "5101", "", "TRUE", ""],
      ["5101-02", "أجور سواق توصيل", "expense", "5101", "", "TRUE", ""],
      ["5101-03", "ديزل توصيل", "expense", "5101", "", "TRUE", ""],
      ["5101-04", "مقدم عمال تركيب", "expense", "5101", "", "TRUE", ""],
      ["5101-05", "أجور تسليم", "expense", "5101", "", "TRUE", ""],
      ["5101-06", "مصاريف أخرى (تجهيز)", "expense", "5101", "", "TRUE", ""],
      ["5101-08", "أجور موتر مستأجر (تجهيز)", "expense", "5101", "", "TRUE", ""],
      ["5102", "تكاليف التركيب في الموقع", "expense", "5100", "", "TRUE", ""],
      ["5102-01", "أجور تركيب", "expense", "5102", "", "TRUE", ""],
      ["5102-02", "وجبات وضيافة عمال", "expense", "5102", "", "TRUE", ""],
      ["5102-03", "مشتريات طارئة", "expense", "5102", "", "TRUE", ""],
      ["5102-04", "نقل فرش إضافي", "expense", "5102", "", "TRUE", ""],
    ["5102-05", "مصاريف أخرى (تركيب)", "expense", "5102", "", "TRUE", ""],
    ["5102-06", "أجور سواق (تركيب)", "expense", "5102", "", "TRUE", ""],
    ["5102-07", "ديزل (تركيب)", "expense", "5102", "", "TRUE", ""],
    ["5102-08", "موتر مستأجر (تركيب)", "expense", "5102", "", "TRUE", ""],
    ["5102-09", "تنظيف الصالة", "expense", "5102", "", "TRUE", ""],
    ["5102-10", "حراسة الصالة", "expense", "5102", "", "TRUE", ""],
      ["5103", "تكاليف الفك والعودة", "expense", "5100", "", "TRUE", ""],
      ["5103-01", "أجور فك", "expense", "5103", "", "TRUE", ""],
      ["5103-02", "أجور سواق عودة", "expense", "5103", "", "TRUE", ""],
      ["5103-03", "ديزل عودة", "expense", "5103", "", "TRUE", ""],
      ["5103-04", "حراسة ونقطة", "expense", "5103", "", "TRUE", ""],
      ["5103-05", "تنظيف الموقع", "expense", "5103", "", "TRUE", ""],
      ["5103-06", "مصاريف أخرى (فك)", "expense", "5103", "", "TRUE", ""],
      ["5103-08", "أجور موتر مستأجر (عودة)", "expense", "5103", "", "TRUE", ""],
      ["5104", "توالف ومفقودات", "expense", "5100", "", "TRUE", ""],
      ["5104-01", "توالف على العميل", "expense", "5104", "", "TRUE", ""],
      ["5104-02", "توالف على العمال", "expense", "5104", "", "TRUE", ""],
      ["5104-03", "توالف على السواق", "expense", "5104", "", "TRUE", ""],
      ["5104-04", "توالف على الحارس", "expense", "5104", "", "TRUE", ""],
      ["5104-05", "توالف على النظام", "expense", "5104", "", "TRUE", ""],
    ];
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: "Chart_Of_Accounts!A2",
      valueInputOption: "RAW",
      requestBody: { values: defaultAccounts },
    });
    return;
  }

  // Migrate: add missing default accounts
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: "Chart_Of_Accounts!A:A",
  });
  const existingCodes = new Set((res.data.values || []).slice(1).map((r) => r[0]));
  const missingDefaults = [
    ["1100", "النقدية والأرصدة لدى البنوك", "asset", "", "", "TRUE", ""],
    ["1101", "صندوق الصالة الرئيسي", "asset", "1100", "", "TRUE", ""],
    ["1102", "محفظة كريمي", "asset", "1100", "", "TRUE", ""],
    ["1103", "محفظة جوالي", "asset", "1100", "", "TRUE", ""],
    ["1104", "محفظة جيب", "asset", "1100", "", "TRUE", ""],
    ["4001", "إيرادات الحجوزات", "income", "", "", "TRUE", ""],
    ["4001-01", "إيرادات الصالة", "income", "4001", "حجوزات الصالة هابي لاند", "TRUE", ""],
    ["4001-02", "إيرادات المخيمات", "income", "4001", "حجوزات الخيام", "TRUE", ""],
    ["4002", "إيرادات إلغاء حجوزات", "income", "", "", "TRUE", ""],
    ["4003", "إيرادات أخرى", "income", "", "", "TRUE", ""],
    ["4004", "إيرادات الكوش", "income", "", "", "TRUE", ""],
    ["4004-01", "إيرادات كوش", "income", "4004", "", "TRUE", ""],
    ["5001", "كهرباء", "expense", "", "", "TRUE", ""],
    ["5001-01", "كهرباء الصالة", "expense", "5001", "حجوزات الصالة هابي لاند", "TRUE", ""],
    ["5001-01-01", "كهرباء الصالة - حكومي", "expense", "5001-01", "", "TRUE", ""],
    ["5001-01-02", "كهرباء الصالة - مولد جعفر", "expense", "5001-01", "", "TRUE", ""],
    ["5001-01-03", "كهرباء الصالة - مولد الصمود", "expense", "5001-01", "", "TRUE", ""],
    ["5001-02", "كهرباء الورشة", "expense", "5001", "حجوزات الخيام", "TRUE", ""],
    ["5001-03", "كهرباء المكتب", "expense", "5001", "", "TRUE", "CC-DHM-OFFICE"],
    ["5002", "نقل", "expense", "", "", "TRUE", ""],
    ["5003", "صيانة", "expense", "", "", "TRUE", ""],
    ["5003-01", "صيانة الخيام", "expense", "5003", "", "TRUE", "CC-DHM-TENTS"],
    ["5003-02", "صيانة الصالة", "expense", "5003", "", "TRUE", "CC-DHM-HALL"],
    ["5004", "رواتب", "expense", "", "", "TRUE", ""],
    ["5004-01", "رواتب العمال", "expense", "5004", "", "TRUE", "CC-DHM-ADMIN"],
    ["5004-02", "رواتب إداري", "expense", "5004", "", "TRUE", "CC-DHM-OFFICE"],
    ["5005", "إيجار", "expense", "", "", "TRUE", ""],
    ["5006", "قرطاسية", "expense", "", "", "TRUE", ""],
    ["5007", "تحويلات داخلية", "expense", "", "", "TRUE", ""],
    ["5008", "رخص وتصاريح", "expense", "", "", "TRUE", ""],
    ["5008-01", "رخص وتصاريح", "expense", "5008", "", "TRUE", "CC-DHM-OFFICE"],
    ["5008-02", "اتصالات وإنترنت", "expense", "5008", "", "TRUE", "CC-DHM-OFFICE"],
    ["5009", "حراسة ونظافة", "expense", "", "", "TRUE", ""],
    ["5009-01", "أجور حراسة", "expense", "5009", "", "TRUE", "CC-DHM-HALL"],
    ["5009-02", "أجور نظافة", "expense", "5009", "", "TRUE", "CC-DHM-HALL"],
    ["5100", "تكاليف ميدانية", "expense", "", "", "TRUE", ""],
    ["5101", "تكاليف التجهيز والتحميل", "expense", "5100", "", "TRUE", ""],
    ["5101-01", "أجور تحميل", "expense", "5101", "", "TRUE", ""],
    ["5101-02", "أجور سواق توصيل", "expense", "5101", "", "TRUE", ""],
    ["5101-03", "ديزل توصيل", "expense", "5101", "", "TRUE", ""],
    ["5101-04", "مقدم عمال تركيب", "expense", "5101", "", "TRUE", ""],
    ["5101-05", "أجور تسليم", "expense", "5101", "", "TRUE", ""],
    ["5101-06", "مصاريف أخرى (تجهيز)", "expense", "5101", "", "TRUE", ""],
    ["5101-08", "أجور موتر مستأجر (تجهيز)", "expense", "5101", "", "TRUE", ""],
    ["5102", "تكاليف التركيب في الموقع", "expense", "5100", "", "TRUE", ""],
    ["5102-01", "أجور تركيب", "expense", "5102", "", "TRUE", ""],
    ["5102-02", "وجبات وضيافة عمال", "expense", "5102", "", "TRUE", ""],
    ["5102-03", "مشتريات طارئة", "expense", "5102", "", "TRUE", ""],
    ["5102-04", "نقل فرش إضافي", "expense", "5102", "", "TRUE", ""],
    ["5102-05", "مصاريف أخرى (تركيب)", "expense", "5102", "", "TRUE", ""],
    ["5102-06", "أجور سواق (تركيب)", "expense", "5102", "", "TRUE", ""],
    ["5102-07", "ديزل (تركيب)", "expense", "5102", "", "TRUE", ""],
    ["5102-08", "موتر مستأجر (تركيب)", "expense", "5102", "", "TRUE", ""],
    ["5102-09", "تنظيف الصالة", "expense", "5102", "", "TRUE", ""],
    ["5102-10", "حراسة الصالة", "expense", "5102", "", "TRUE", ""],
    ["5103", "تكاليف الفك والعودة", "expense", "5100", "", "TRUE", ""],
    ["5103-01", "أجور فك", "expense", "5103", "", "TRUE", ""],
    ["5103-02", "أجور سواق عودة", "expense", "5103", "", "TRUE", ""],
    ["5103-03", "ديزل عودة", "expense", "5103", "", "TRUE", ""],
    ["5103-04", "حراسة ونقطة", "expense", "5103", "", "TRUE", ""],
    ["5103-05", "تنظيف الموقع", "expense", "5103", "", "TRUE", ""],
    ["5103-06", "مصاريف أخرى (فك)", "expense", "5103", "", "TRUE", ""],
    ["5103-08", "أجور موتر مستأجر (عودة)", "expense", "5103", "", "TRUE", ""],
    ["5104", "توالف ومفقودات", "expense", "5100", "", "TRUE", ""],
    ["5104-01", "توالف على العميل", "expense", "5104", "", "TRUE", ""],
    ["5104-02", "توالف على العمال", "expense", "5104", "", "TRUE", ""],
    ["5104-03", "توالف على السواق", "expense", "5104", "", "TRUE", ""],
    ["5104-04", "توالف على الحارس", "expense", "5104", "", "TRUE", ""],
    ["5104-05", "توالف على النظام", "expense", "5104", "", "TRUE", ""],
    ["2203-01", "مصاريف شخصية", "equity", "2203", "", "TRUE", ""],
    ["2203-02", "مساعدات عائلية", "equity", "2203", "", "TRUE", ""],
    ["2203-03", "صدقات وتبرعات", "equity", "2203", "", "TRUE", ""],
    ["2203-04", "نثريات وأخرى", "equity", "2203", "", "TRUE", ""],
  ];
  for (const row of missingDefaults) {
    if (!existingCodes.has(row[0])) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID, range: "Chart_Of_Accounts!A:G",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [row] },
      });
    }
  }
}

async function ensureCostCenterCodeColumn() {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Chart_Of_Accounts!A1:G1",
    });
    const existingHeaders = res.data.values?.[0] || [];
    if (!existingHeaders.includes("CostCenterCode")) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID, range: "Chart_Of_Accounts!G1",
        valueInputOption: "RAW",
        requestBody: { values: [["CostCenterCode"]] },
      });
      const accts = await getSheetData("Chart_Of_Accounts", "A2:F");
      if (accts.length > 0) {
        const fill = accts.map(() => [""]);
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID, range: "Chart_Of_Accounts!G2",
          valueInputOption: "RAW",
          requestBody: { values: fill },
        });
      }
    }
  } catch { /* sheet may not exist yet */ }
}

async function ensureLessorColumns() {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Chart_Of_Accounts!A1:I1",
    });
    const existingHeaders = res.data.values?.[0] || [];
    if (!existingHeaders.includes("LessorName")) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID, range: "Chart_Of_Accounts!H1",
        valueInputOption: "RAW",
        requestBody: { values: [["LessorName"]] },
      });
    }
    if (!existingHeaders.includes("LessorPhone")) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID, range: "Chart_Of_Accounts!I1",
        valueInputOption: "RAW",
        requestBody: { values: [["LessorPhone"]] },
      });
    }
    if (!existingHeaders.includes("LessorName") || !existingHeaders.includes("LessorPhone")) {
      const accts = await getSheetData("Chart_Of_Accounts", "A2:G");
      if (accts.length > 0) {
        const fill = accts.map(() => [""]);
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID, range: "Chart_Of_Accounts!H2",
          valueInputOption: "RAW",
          requestBody: { values: fill },
        });
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID, range: "Chart_Of_Accounts!I2",
          valueInputOption: "RAW",
          requestBody: { values: fill },
        });
      }
    }
  } catch {}
}

export async function GET(request) {
  try {
    await ensureSheet();
    await ensureCostCenterCodeColumn();
    await ensureLessorColumns();
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";
    const accounts = await getChartOfAccounts(includeInactive);
    return NextResponse.json({ success: true, accounts });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    await ensureSheet();
    const body = await request.json();
    const { accountCode, accountName, accountType, parentCode, linkedBookingType, costCenterCode } = body;
    if (!accountCode || !accountName) {
      return NextResponse.json({ success: false, error: "كود الحساب واسمه مطلوبان" }, { status: 400 });
    }
    const result = await addAccount({ accountCode, accountName, accountType, parentCode, linkedBookingType, costCenterCode });
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 409 });
    }
    return NextResponse.json({ success: true, message: `تم إضافة الحساب ${accountName}` });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    await ensureSheet();
    const body = await request.json();
    const { originalCode, accountCode, accountName, accountType, parentCode, linkedBookingType, costCenterCode, lessorName, lessorPhone } = body;
    if (!originalCode) {
      return NextResponse.json({ success: false, error: "كود الحساب الأصلي مطلوب" }, { status: 400 });
    }
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Chart_Of_Accounts!A:I",
    });
    const rows = res.data.values || [];
    const idx = rows.findIndex((r) => r[0] === originalCode);
    if (idx < 0) {
      return NextResponse.json({ success: false, error: "الحساب غير موجود" }, { status: 404 });
    }
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: `Chart_Of_Accounts!A${idx + 1}:I${idx + 1}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          accountCode || rows[idx][0],
          accountName || rows[idx][1] || "",
          accountType || rows[idx][2] || "expense",
          parentCode ?? rows[idx][3] ?? "",
          linkedBookingType ?? rows[idx][4] ?? "",
          rows[idx][5] ?? "TRUE",
          costCenterCode !== undefined ? costCenterCode : (rows[idx][6] || ""),
          lessorName !== undefined ? lessorName : (rows[idx][7] || ""),
          lessorPhone !== undefined ? lessorPhone : (rows[idx][8] || ""),
        ]],
      },
    });
    return NextResponse.json({ success: true, message: "تم تحديث الحساب" });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    const body = await request.json();
    const { accountCode, isActive } = body;
    if (!accountCode) {
      return NextResponse.json({ success: false, error: "كود الحساب مطلوب" }, { status: 400 });
    }
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Chart_Of_Accounts!A:I",
    });
    const rows = res.data.values || [];
    const idx = rows.findIndex((r) => r[0] === accountCode);
    if (idx < 0) {
      return NextResponse.json({ success: false, error: "الحساب غير موجود" }, { status: 404 });
    }
    const newValue = isActive ? "TRUE" : "FALSE";
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: `Chart_Of_Accounts!F${idx + 1}`,
      valueInputOption: "RAW",
      requestBody: { values: [[newValue]] },
    });
    return NextResponse.json({ success: true, message: isActive ? "تم استرجاع الحساب" : "تم إخفاء الحساب" });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const permanent = searchParams.get("permanent") === "true";
    if (!code) {
      return NextResponse.json({ success: false, error: "كود الحساب مطلوب" }, { status: 400 });
    }
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Chart_Of_Accounts!A:I",
    });
    const rows = res.data.values || [];
    const allIndices = rows.map((r, i) => r[0] === code ? i : -1).filter(i => i >= 0);
    if (allIndices.length === 0) {
      return NextResponse.json({ success: false, error: "الحساب غير موجود" }, { status: 404 });
    }

    if (permanent) {
      for (const idx of allIndices) {
        await sheets.spreadsheets.values.clear({
          spreadsheetId: SPREADSHEET_ID,
          range: `Chart_Of_Accounts!A${idx + 1}:I${idx + 1}`,
        });
      }
      return NextResponse.json({ success: true, message: `تم حذف الحساب ${code} نهائياً` });
    } else {
      for (const idx of allIndices) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID, range: `Chart_Of_Accounts!F${idx + 1}`,
          valueInputOption: "RAW",
          requestBody: { values: [["FALSE"]] },
        });
      }
      return NextResponse.json({ success: true, message: allIndices.length > 1 ? `تم إخفاء ${allIndices.length} نسخة من الحساب ${code}` : "تم إخفاء الحساب" });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
