// Quick test to verify contract creation works
const body = {
  customerName: "تجربة العقد",
  customerPhone: "0555000111",
  startDate: "2026-06-01",
  endDate: "2026-06-03",
  totalAmount: 3000,
  paidAmount: 1500,
  status: "مؤكد",
};

async function test() {
  console.log("Testing contract creation...");
  const res = await fetch("http://localhost:3000/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  console.log("Status:", res.status);
  console.log("Response:", JSON.stringify(data, null, 2));
  
  if (data.success && data.booking?.contractLink) {
    console.log("\n✅ Contract created successfully!");
    console.log("📄 Contract link:", data.booking.contractLink);
  } else if (data.warning) {
    console.log("\n⚠️ Warning:", data.warning);
  } else {
    console.log("\n❌ Failed:", data.error);
  }
}

test().catch(console.error);
