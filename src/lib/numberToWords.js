const ones = { 1: "واحد", 2: "اثنان", 3: "ثلاثة", 4: "أربعة", 5: "خمسة", 6: "ستة", 7: "سبعة", 8: "ثمانية", 9: "تسعة" };
const tensMap = { 2: "عشرون", 3: "ثلاثون", 4: "أربعون", 5: "خمسون", 6: "ستون", 7: "سبعون", 8: "ثمانون", 9: "تسعون" };
const teensMap = { 10: "عشرة", 11: "أحد عشر", 12: "اثنا عشر", 13: "ثلاثة عشر", 14: "أربعة عشر", 15: "خمسة عشر", 16: "ستة عشر", 17: "سبعة عشر", 18: "ثمانية عشر", 19: "تسعة عشر" };
const hundredsMap = { 1: "مئة", 2: "مئتان", 3: "ثلاث مئة", 4: "أربع مئة", 5: "خمس مئة", 6: "ست مئة", 7: "سبع مئة", 8: "ثمان مئة", 9: "تسع مئة" };

function convertUnder1000(n) {
  let parts = [];
  const h = Math.floor(n / 100);
  if (h > 0) parts.push(hundredsMap[h]);
  n %= 100;
  if (n >= 20) {
    const t = Math.floor(n / 10);
    parts.push(tensMap[t]);
    n %= 10;
  } else if (n >= 10) {
    parts.push(teensMap[n]);
    n = 0;
  }
  if (n > 0) parts.push(ones[n]);
  return parts.join(" و ");
}

export function numberToWords(num) {
  if (num === 0) return "صفر";
  const n = Math.floor(Math.abs(num));
  const sign = num < 0 ? "سالب " : "";

  const groups = [
    { divisor: 1_000_000_000, singular: "مليار", dual: "ملياران", plural: "مليارات" },
    { divisor: 1_000_000, singular: "مليون", dual: "مليونان", plural: "ملايين" },
    { divisor: 1_000, singular: "ألف", dual: "ألفان", plural: "آلاف" },
  ];

  let remaining = n;
  let parts = [];

  for (const g of groups) {
    const count = Math.floor(remaining / g.divisor);
    remaining %= g.divisor;

    if (count > 0) {
      if (count === 1) {
        parts.push(g.singular);
      } else if (count === 2) {
        parts.push(g.dual);
      } else {
        const below1000 = convertUnder1000(count);
        // Adjust feminine for 3-10 with "آلاف" and "ملايين"
        if (g.divisor === 1000 && count >= 3 && count <= 10) {
          const adjusted = { 3: "ثلاثة", 4: "أربعة", 5: "خمسة", 6: "ستة", 7: "سبعة", 8: "ثمانية", 9: "تسعة", 10: "عشرة" };
          parts.push(`${adjusted[count] || below1000} ${g.plural}`);
        } else {
          parts.push(`${below1000} ${g.plural}`);
        }
      }
    }
  }

  if (remaining > 0) {
    parts.push(convertUnder1000(remaining));
  }

  return sign + parts.join(" و ");
}

export function amountInWords(amount) {
  const intPart = Math.floor(amount);
  const words = numberToWords(intPart);
  return `${words} ريال يمني لا غير`;
}
