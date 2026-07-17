const { loadEnvConfig } = require("@next/env");
const path = require("path");

// Load Next.js environment variables
loadEnvConfig(path.resolve(__dirname));

const { signToken } = require("./src/lib/auth");

const port = process.env.PORT || 3000;
const token = signToken({ id: "admin", role: "admin", name: "Admin" });

console.log("Using JWT_SECRET:", process.env.JWT_SECRET ? "Loaded successfully" : "Using fallback");
console.log("Generated Admin Token:", token);

fetch(`http://localhost:${port}/api/calendar/import`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  },
  body: JSON.stringify({
    icsUrl: "https://calendar.google.com/calendar/ical/akramabduallh%40gmail.com/private-1dde824bde8a127ccda4191caf0911d0/basic.ics"
  })
})
  .then(async res => {
    console.log("API Status:", res.status);
    const data = await res.json();
    console.log("API Response:", JSON.stringify(data, null, 2).slice(0, 500));
  })
  .catch(err => {
    console.error("API Call Failed:", err.message);
  });
