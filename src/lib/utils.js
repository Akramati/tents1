"use client";

export const getTodayString = () => {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const localToday = new Date(today.getTime() - (offset * 60 * 1000));
  return localToday.toISOString().split("T")[0];
};

export const formatCurrency = (val) =>
  new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(val);

export const formatDateArabic = (dateStr) => {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export const getBehavior = (typeName, bookingTypes = []) => {
  const found = bookingTypes.find((t) => t.typeName === typeName);
  return found ? found.behavior : "individual";
};

export const TENT_LENGTHS = ["8", "10", "12", "14", "16", "20"];
export const TENT_WIDTHS = ["6", "8", "10", "12", "20"];

export const computeMaxTentLength = (width, packages = []) => {
  const w = parseFloat(width);
  if (!w || packages.length === 0) return null;
  let maxL = null;
  for (const pkg of packages) {
    for (const [sizeKey, _l] of Object.entries(pkg.widths || {})) {
      const sizeW = parseFloat(sizeKey);
      if (sizeW === w) {
        const lengths = _l
          ?.split(",")
          .map((s) => parseFloat(s.trim()))
          .filter((n) => !isNaN(n)) || [];
        for (const l of lengths) {
          if (maxL === null || l > maxL) maxL = l;
        }
      }
    }
  }
  return maxL;
};
