const express = require('express');
const cors = require('cors');
const path = require('path');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ================= IN-MEMORY DATA STORES =================
const users = [];
const lots = [];
const pools = [];
const transactions = [];

// Multi-District Cold Storage Network (Punjab, West Bengal, Bihar, UP)
const ALL_COLD_STORAGES = [
  // --- Punjab ---
  {
    id: "STR-PB-ASR-01",
    name: "Amritsar Golden Agro Cold Chain",
    district: "Amritsar",
    state: "Punjab",
    crop: "Potato",
    capacityAvailable: "3,200 Qtl",
    dailyRatePerQtl: 1.45,
    lat: 31.6340,
    lng: 74.8723,
    contact: "+91 98140-11223"
  },
  {
    id: "STR-PB-ASR-02",
    name: "Majha Kisan Cold Storage Hub",
    district: "Amritsar",
    state: "Punjab",
    crop: "Tomato",
    capacityAvailable: "1,100 Qtl",
    dailyRatePerQtl: 1.60,
    lat: 31.6500,
    lng: 74.9100,
    contact: "+91 98140-44556"
  },
  {
    id: "STR-PB-LDH-01",
    name: "Ludhiana Central Agro Warehouse",
    district: "Ludhiana",
    state: "Punjab",
    crop: "Potato",
    capacityAvailable: "4,500 Qtl",
    dailyRatePerQtl: 1.40,
    lat: 30.9010,
    lng: 75.8573,
    contact: "+91 98140-88990"
  },
  // --- West Bengal ---
  {
    id: "STR-WB-JAL-01",
    name: "Harimandir Cold Storage",
    district: "Jalpaiguri",
    state: "West Bengal",
    crop: "Potato",
    capacityAvailable: "450 Qtl",
    dailyRatePerQtl: 1.25,
    lat: 26.5400,
    lng: 88.7200,
    contact: "+91 98001-22334"
  },
  {
    id: "STR-WB-DAR-01",
    name: "Siliguri Agri Logistic Hub",
    district: "Darjeeling",
    state: "West Bengal",
    crop: "Tomato",
    capacityAvailable: "1,200 Qtl",
    dailyRatePerQtl: 1.50,
    lat: 26.7100,
    lng: 88.4300,
    contact: "+91 98001-55667"
  },
  // --- Bihar ---
  {
    id: "STR-BR-PAT-01",
    name: "Patna Mega Food Cold Chain",
    district: "Patna",
    state: "Bihar",
    crop: "Rice",
    capacityAvailable: "2,800 Qtl",
    dailyRatePerQtl: 1.20,
    lat: 25.5941,
    lng: 85.1376,
    contact: "+91 98350-11223"
  },
  // --- Uttar Pradesh ---
  {
    id: "STR-UP-VAR-01",
    name: "Kashi Integrated Cold Store",
    district: "Varanasi",
    state: "Uttar Pradesh",
    crop: "Tomato",
    capacityAvailable: "900 Qtl",
    dailyRatePerQtl: 1.35,
    lat: 25.3176,
    lng: 82.9739,
    contact: "+91 98390-33445"
  }
];

// Verified Bulk Buyers
const ALL_BUYERS = [
  { id: "BUY-ASR-01", name: "Amritsar Foods & Export Corp", district: "Amritsar", crop: "Potato", buyingRate: 1620, lat: 31.6300, lng: 74.8800 },
  { id: "BUY-ASR-02", name: "Punjab Grain & Processing Mill", district: "Amritsar", crop: "Rice", buyingRate: 3100, lat: 31.6450, lng: 74.8600 },
  { id: "BUY-JAL-01", name: "Dooars Agro Food Pvt Ltd", district: "Jalpaiguri", crop: "Potato", buyingRate: 1650, lat: 26.5450, lng: 88.7100 },
  { id: "BUY-DAR-01", name: "Siliguri Fresh Hub", district: "Darjeeling", crop: "Tomato", buyingRate: 2520, lat: 26.7200, lng: 88.4200 },
  { id: "BUY-PAT-01", name: "Magadh Agro Processing Hub", district: "Patna", crop: "Rice", buyingRate: 2950, lat: 25.6000, lng: 85.1400 },
  { id: "BUY-VAR-01", name: "Varanasi Fresh Retail Chain", district: "Varanasi", crop: "Tomato", buyingRate: 2480, lat: 25.3200, lng: 82.9800 }
];

// Seed Baseline Market Lots
lots.push(
  {
    lotId: "UPJ-PB-101",
    farmerId: "FARM-PB-01",
    farmerName: "Gurpreet Singh",
    farmerPhone: "9814012345",
    crop: "Potato",
    grade: "Grade A (Assayed)",
    quantity: 120,
    expectedPrice: 1450,
    location: "Amritsar, Punjab",
    status: "ACTIVE"
  },
  {
    lotId: "UPJ-WB-102",
    farmerId: "FARM-WB-02",
    farmerName: "Ramesh Ghosh",
    farmerPhone: "9883860358",
    crop: "Tomato",
    grade: "Grade A (Assayed)",
    quantity: 45,
    expectedPrice: 2400,
    location: "Jalpaiguri, West Bengal",
    status: "ACTIVE"
  }
);

// ================= API ROUTES =================

// 1. Authentication (Simulated OTP)
app.post('/api/auth/send-otp', (req, res) => {
  const { phone } = req.body;
  if (!phone || phone.length !== 10) {
    return res.status(400).json({ error: "Invalid 10-digit mobile number." });
  }
  res.json({ success: true, demoOtp: "123456" });
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { phone, otp, mode, name, role, state, district } = req.body;
  if (otp !== "123456") {
    return res.status(400).json({ error: "Invalid OTP code entered." });
  }
  let existing = users.find(u => u.phone === phone);
  if (!existing) {
    existing = {
      id: `${(role || 'FARMER').toUpperCase().slice(0, 4)}-${(state || 'IN').slice(0, 2).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
      name: name || "Verified Producer",
      phone,
      role: role || "Farmer",
      state: state || "Punjab",
      district: district || "Amritsar",
      location: `${district || 'Amritsar'}, ${state || 'Punjab'}`
    };
    users.push(existing);
  }
  res.json({ success: true, user: existing });
});

// 2. Proximity Radar (Storages & Buyers)
app.get('/api/proximity/storages', (req, res) => {
  const { district, crop } = req.query;
  let results = ALL_COLD_STORAGES;

  if (district && district !== 'All') {
    results = results.filter(s => s.district.toLowerCase() === district.toLowerCase());
  }
  if (crop && crop !== 'All') {
    results = results.filter(s => s.crop.toLowerCase() === crop.toLowerCase());
  }

  const mapped = results.map(s => ({
    ...s,
    distanceKm: Math.floor(Math.random() * 18) + 4
  }));

  res.json(mapped);
});

app.get('/api/proximity/buyers', (req, res) => {
  const { district, crop } = req.query;
  let results = ALL_BUYERS;

  if (district && district !== 'All') {
    results = results.filter(b => b.district.toLowerCase() === district.toLowerCase());
  }
  if (crop && crop !== 'All') {
    results = results.filter(b => b.crop.toLowerCase() === crop.toLowerCase());
  }

  const mapped = results.map(b => ({
    ...b,
    distanceKm: Math.floor(Math.random() * 15) + 3
  }));

  res.json(mapped);
});

// 3. Lots & Trading
app.get('/api/lots', (req, res) => {
  res.json(lots);
});

app.post('/api/lots/create', (req, res) => {
  const lot = {
    ...req.body,
    lotId: "UPJ-" + Math.floor(100000 + Math.random() * 900000),
    status: "ACTIVE",
    timestamp: new Date().toISOString()
  };
  lots.unshift(lot);
  res.json({ success: true, lot });
});

// 4. UPI Dynamic QR Generator
app.post('/api/payments/generate-upi-qr', async (req, res) => {
  const { amount, lotId, buyerName } = req.body;
  const vpa = "upajtantram.escrow@rbi-nodal";
  const upiIntent = `upi://pay?pa=${vpa}&pn=UpajTantramEscrow&am=${amount}&cu=INR&tn=Lot_${lotId}`;
  
  try {
    const qrDataUrl = await QRCode.toDataURL(upiIntent, { width: 220, margin: 1 });
    const mockUtr = "UTR" + Math.floor(100000000000 + Math.random() * 900000000000);
    res.json({ success: true, qrDataUrl, vpa, mockUtr, upiIntent });
  } catch (e) {
    res.status(500).json({ error: "Failed to generate QR code." });
  }
});

app.post('/api/trade/escrow-lock', (req, res) => {
  const { lotId, buyerId, buyerName, bidPrice } = req.body;
  const target = lots.find(l => l.lotId === lotId);
  if (target) target.status = "IN_ESCROW";

  const tx = {
    txId: "TXN-" + Math.floor(100000 + Math.random() * 900000),
    lotId,
    buyerId,
    buyerName,
    bidPrice,
    status: "FUNDS_LOCKED_IN_NODAL",
    timestamp: new Date().toISOString()
  };
  transactions.push(tx);
  res.json({ success: true, transaction: tx });
});

// 5. Weather Advisory & Telemetry
app.get('/api/advisory/weather', (req, res) => {
  const district = req.query.district || "Amritsar";
  res.json({
    district,
    temperature: "28°C",
    humidity: "82%",
    rainfallProbability: "70%",
    aiAdvisory: `Monsoon humidity advisory in ${district}. Open storage risks fungal decay. Shift produce to cold storage or lock sales.`
  });
});

// 6. FPO Pooling
app.get('/api/fpo/pools', (req, res) => {
  res.json(pools);
});

app.post('/api/fpo/create-pool', (req, res) => {
  const pool = {
    poolId: "POOL-" + Math.floor(1000 + Math.random() * 9000),
    crop: req.body.crop,
    targetQuantity: req.body.targetQuantity,
    targetPrice: req.body.targetPrice,
    currentQuantity: 0,
    status: "OPEN_FOR_CONTRIBUTIONS"
  };
  pools.unshift(pool);
  res.json(pool);
});

app.post('/api/fpo/contribute', (req, res) => {
  const { poolId, quantity } = req.body;
  const target = pools.find(p => p.poolId === poolId);
  if (target) {
    target.currentQuantity = (Number(target.currentQuantity) || 0) + Number(quantity);
    if (target.currentQuantity >= target.targetQuantity) {
      target.status = "READY_FOR_DISPATCH";
    }
  }
  res.json({ success: true, pool: target });
});

// 7. Logistics & Finance
app.post('/api/logistics/book', (req, res) => {
  const km = Number(req.body.distanceKm) || 40;
  const v = req.body.vehicleType || "Pickup (1.5T)";
  const rate = v.includes('1.5T') ? 20 : v.includes('4T') ? 32 : 50;
  res.json({
    success: true,
    bookingId: "TRK-" + Math.floor(10000 + Math.random() * 90000),
    estimatedFreight: Math.round(km * rate + 500),
    driverPhone: "+91 98140-" + Math.floor(10000 + Math.random() * 90000)
  });
});

app.post('/api/finance/pledge-loan', (req, res) => {
  const { quantity, marketRate } = req.body;
  const total = Number(quantity) * Number(marketRate);
  const sanctioned = Math.round(total * 0.7);
  res.json({
    success: true,
    loanId: "LN-eNWR-" + Math.floor(100000 + Math.random() * 900000),
    sanctionedAmount: sanctioned,
    rateOfInterest: "7.0% p.a."
  });
});

app.post('/api/disputes/raise', (req, res) => {
  res.json({
    success: true,
    disputeId: "DSP-" + Math.floor(1000 + Math.random() * 9000),
    message: "Escrow funds locked in nodal trust. Dispatched notification to regional mediator."
  });
});

// 8. Schemes Directory
app.get('/api/schemes', (req, res) => {
  res.json([
    {
      name: "PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)",
      category: "Income Support",
      ministry: "Ministry of Agriculture and Farmers Welfare",
      benefit: "₹6,000 per year in 3 equal installments directly via DBT.",
      eligibility: "All landholding farmer families across India.",
      officialUrl: "https://pmkisan.gov.in"
    },
    {
      name: "Pradhan Mantri Fasal Bima Yojana (PMFBY)",
      category: "Crop Insurance",
      ministry: "Ministry of Agriculture and Farmers Welfare",
      benefit: "Subsidized insurance coverage against non-preventable natural risks (2% Kharif, 1.5% Rabi).",
      eligibility: "Farmers growing notified crops in notified areas.",
      officialUrl: "https://pmfby.gov.in"
    },
    {
      name: "Agriculture Infrastructure Fund (AIF)",
      category: "Post-Harvest & Storage",
      ministry: "Department of Agriculture & Farmers Welfare",
      benefit: "3% interest subvention on loans up to ₹2 Crore for cold storage, sorting, and grading setups.",
      eligibility: "Primary Agricultural Credit Societies, FPOs, Agri-entrepreneurs.",
      officialUrl: "https://agriinfra.dac.gov.in"
    }
  ]);
});

// 9. Multilingual AI Assistant
app.post('/api/ai/chat', (req, res) => {
  const { message, lang, userDistrict } = req.body;
  const clean = (message || "").toLowerCase();
  let reply = `In ${userDistrict || 'your area'}, market modal rates remain resilient. High humidity suggests keeping perishable lots in cold storage.`;
  let detectedLang = lang || 'en';

  if (clean.includes("storage") || clean.includes("হিমাগার") || clean.includes("कोल्ड")) {
    reply = `Nearby accredited storage facilities have verified vacancies. You can sanction up to 70% e-NWR credit against deposited commodities.`;
  } else if (clean.includes("rate") || clean.includes("price") || clean.includes("দাম") || clean.includes("भाव")) {
    reply = `Modal rates for Potato stand around ₹1,450-₹1,620/Qtl, Tomato around ₹2,450/Qtl, and Rice around ₹1,680-₹3,100/Qtl depending on assayed grade.`;
  }

  if (lang === 'bn' || /[\u0980-\u09FF]/.test(clean)) {
    detectedLang = 'bn';
    reply = `আপনার এলাকায় কোল্ড স্টোরেজ সুবিধা এবং ন্যায্য বাজারদর উপলব্ধ আছে। যেকোনো ফসলের গুণমান স্ক্যান করে সরাসরি বিক্রি করতে পারেন।`;
  } else if (lang === 'hi' || /[\u0900-\u097F]/.test(clean)) {
    detectedLang = 'hi';
    reply = `आपके क्षेत्र में भंडार गृह और पारदर्शी मंडी दरें उपलब्ध हैं। आप बिना बिचौलियों के सीधे खरीदारों से 0% डिफ़ॉल्ट एस्क्रो में भुगतान पा सकते हैं।`;
  }

  res.json({ reply, detectedLang });
});

app.listen(PORT, () => {
  console.log(`🌾 UpajTantram Server running on http://localhost:${PORT}`);
});
