const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDB } = require('./db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const otpStore = new Map();

const storageFacilities = [
  { id: 'STR-JAL-01', name: 'Harimandir Cold Storage', type: 'Multi-Chamber Cold Storage', cropsSupported: ['Potato', 'Tomato'], district: 'Jalpaiguri', state: 'West Bengal', lat: 26.54, lng: 88.72, distanceKm: 8, capacityAvailable: '1,450 MT', dailyRatePerQtl: 2.40, contact: '+91 94340-11223' },
  { id: 'STR-JAL-02', name: 'Baba Jalpesh Agro Cold Store', type: 'CA Store', cropsSupported: ['Potato', 'Tomato'], district: 'Jalpaiguri', state: 'West Bengal', lat: 26.58, lng: 88.78, distanceKm: 18, capacityAvailable: '920 MT', dailyRatePerQtl: 2.60, contact: '+91 94340-44556' },
  { id: 'STR-DAR-01', name: 'Bagdogra Perishable Cargo Hub', type: 'Cold Storage', cropsSupported: ['Tomato', 'Potato'], district: 'Darjeeling', state: 'West Bengal', lat: 26.69, lng: 88.32, distanceKm: 46, capacityAvailable: '780 MT', dailyRatePerQtl: 3.10, contact: '+91 94340-99887' },
  { id: 'STR-DAR-02', name: 'Mahananda Mega Food Silos', type: 'Grain Silos', cropsSupported: ['Rice', 'Maize'], district: 'Darjeeling', state: 'West Bengal', lat: 26.71, lng: 88.42, distanceKm: 42, capacityAvailable: '4,200 MT', dailyRatePerQtl: 1.25, contact: '+91 94340-67890' }
];

const verifiedBuyers = [
  { id: 'BUY-JAL-01', name: 'Dooars Agro Food Pvt Ltd', crop: 'Potato', buyingRate: 1650, district: 'Jalpaiguri', state: 'West Bengal', lat: 26.52, lng: 88.73, distanceKm: 12, trustScore: '98%', contact: '+91 98001-22334' },
  { id: 'BUY-DAR-01', name: 'Siliguri Foods & Processing', crop: 'Potato', buyingRate: 1680, district: 'Darjeeling', state: 'West Bengal', lat: 26.72, lng: 88.41, distanceKm: 44, trustScore: '99%', contact: '+91 98001-55667' },
  { id: 'BUY-DAR-02', name: 'FreshPact Retail Hub', crop: 'Tomato', buyingRate: 2520, district: 'Darjeeling', state: 'West Bengal', lat: 26.70, lng: 88.38, distanceKm: 48, trustScore: '95%', contact: '+91 98001-99881' },
  { id: 'BUY-JAL-02', name: 'North Bengal Rice Millers', crop: 'Rice', buyingRate: 3260, district: 'Jalpaiguri', state: 'West Bengal', lat: 26.55, lng: 88.70, distanceKm: 15, trustScore: '97%', contact: '+91 98001-44332' }
];

const verifiedGovtSchemes = [
  {
    id: 'SCH-01',
    name: 'PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)',
    ministry: 'Ministry of Agriculture & Farmers Welfare, Govt of India',
    category: 'Income Support',
    benefit: '₹6,000 per year transferred directly to bank accounts in three 4-monthly installments of ₹2,000.',
    eligibility: 'All landholding farmer families with cultivable landholding in their names.',
    officialUrl: 'https://pmkisan.gov.in/'
  },
  {
    id: 'SCH-02',
    name: 'Krishak Bandhu (Natun Scheme)',
    ministry: 'Department of Agriculture, Govt of West Bengal',
    category: 'Income Support',
    benefit: 'Up to ₹10,000 per acre annually (min ₹4,000) in two installments + ₹2 Lakh death claim coverage for families (ages 18–60).',
    eligibility: 'All recorded agricultural landholders and registered Bargadars in West Bengal.',
    officialUrl: 'https://krishakbandhu.wb.gov.in/'
  },
  {
    id: 'SCH-03',
    name: 'Pradhan Mantri Fasal Bima Yojana (PMFBY)',
    ministry: 'Ministry of Agriculture & Farmers Welfare',
    category: 'Crop Insurance',
    benefit: 'Subsidized premium (1.5% to 2% for food crops/oilseeds) with end-to-end risk cover from pre-sowing to post-harvest losses.',
    eligibility: 'All farmers (sharecroppers and tenant farmers included) growing notified crops in notified areas.',
    officialUrl: 'https://pmfby.gov.in/'
  },
  {
    id: 'SCH-04',
    name: 'Agriculture Infrastructure Fund (AIF)',
    ministry: 'Department of Agriculture & Farmers Welfare',
    category: 'Post-Harvest & Storage',
    benefit: 'Loans up to ₹2 Crore at 3% interest subvention per annum for building cold stores, modern silos, and sorting/grading lines.',
    eligibility: 'Farmers, Agri-entrepreneurs, FPOs, PACS, and Self Help Groups.',
    officialUrl: 'https://agriinfra.dac.gov.in/'
  },
  {
    id: 'SCH-05',
    name: 'e-NAM (National Agriculture Market)',
    ministry: 'Small Farmers Agri-Business Consortium (SFAC)',
    category: 'Market Linkage',
    benefit: 'Online inter-state and intra-state auction network connecting 1,400+ regulated mandis for transparent price discovery.',
    eligibility: 'Farmers, traders, and registered Farmer Producer Organizations (FPOs).',
    officialUrl: 'https://enam.gov.in/'
  },
  {
    id: 'SCH-06',
    name: 'Kisan Credit Card (KCC) Scheme',
    ministry: 'Reserve Bank of India (RBI) & NABARD',
    category: 'Credit & Loans',
    benefit: 'Hassle-free institutional credit up to ₹3 Lakh at an effective interest rate of 4% per annum.',
    eligibility: 'Small and marginal farmers, sharecroppers, tenant farmers, and oral lessees.',
    officialUrl: 'https://www.nabard.org/'
  }
];

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// 1. Send OTP
app.post('/api/auth/send-otp', (req, res) => {
  const { phone } = req.body;
  if (!phone || phone.trim().length !== 10) {
    return res.status(400).json({ error: 'Valid 10-digit mobile number required.' });
  }

  const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(phone.trim(), {
    otp: generatedOtp,
    expiresAt: Date.now() + 5 * 60 * 1000
  });

  res.json({
    message: 'OTP dispatched successfully',
    demoOtp: generatedOtp
  });
});

// 2. Verify OTP
app.post('/api/auth/verify-otp', async (req, res) => {
  const { phone, otp, name, role, state, district, mode } = req.body;
  const cleanPhone = (phone || '').trim();
  const record = otpStore.get(cleanPhone);

  if (!record || record.otp !== (otp || '').trim()) {
    return res.status(401).json({ error: 'Invalid OTP entered. Please try again.' });
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(cleanPhone);
    return res.status(410).json({ error: 'OTP has expired. Please request a new code.' });
  }

  otpStore.delete(cleanPhone);
  const db = await getDB();

  if (mode === 'register') {
    const existing = await db.get('SELECT * FROM users WHERE phone = ?', [cleanPhone]);
    if (existing) {
      return res.status(409).json({ error: 'Mobile number already registered. Please login.' });
    }

    const prefix = role === 'Buyer' ? 'BUY' : role === 'FPO' ? 'FPO' : 'FARM';
    const id = `${prefix}-${(state || 'WB').substring(0, 2).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const user = {
      id,
      name: name || 'Verified Producer',
      phone: cleanPhone,
      pin: '0000',
      role: role || 'Farmer',
      state: state || 'West Bengal',
      district: district || 'Jalpaiguri',
      location: `${district || 'Jalpaiguri'}, ${state || 'West Bengal'}`,
      verified: 1,
      createdAt: new Date().toISOString()
    };

    await db.run('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', Object.values(user));
    return res.status(201).json({ message: 'Registration verified and complete!', user });
  } else {
    let user = await db.get('SELECT * FROM users WHERE phone = ?', [cleanPhone]);
    if (!user) {
      const id = `FARM-WB-${Math.floor(1000 + Math.random() * 9000)}`;
      user = {
        id,
        name: 'Farmer User',
        phone: cleanPhone,
        pin: '0000',
        role: 'Farmer',
        state: 'West Bengal',
        district: 'Jalpaiguri',
        location: 'Jalpaiguri, West Bengal',
        verified: 1,
        createdAt: new Date().toISOString()
      };
      await db.run('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', Object.values(user));
    }
    return res.json({ message: 'Login authenticated via OTP!', user });
  }
});

// 3. Government Schemes API
app.get('/api/schemes', (req, res) => {
  res.json(verifiedGovtSchemes);
});

// 4. Live Weather Integration (Open-Meteo API)
app.get('/api/advisory/weather', async (req, res) => {
  const district = req.query.district || 'Jalpaiguri';

  const districtCoords = {
    'Jalpaiguri': { lat: 26.54, lng: 88.72 },
    'Darjeeling': { lat: 27.04, lng: 88.26 },
    'Alipurduar': { lat: 26.49, lng: 89.52 },
    'Cooch Behar': { lat: 26.32, lng: 89.45 },
    'Malda': { lat: 25.01, lng: 88.14 },
    'Kishanganj': { lat: 26.09, lng: 87.94 },
    'Patna': { lat: 25.59, lng: 85.13 },
    'Varanasi': { lat: 25.31, lng: 82.97 }
  };

  const coords = districtCoords[district] || { lat: 26.54, lng: 88.72 };

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&current=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code&timezone=auto`;
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const data = await response.json();

    const temp = `${Math.round(data.current.temperature_2m)}°C`;
    const hum = `${Math.round(data.current.relative_humidity_2m)}%`;
    const rain = `${data.current.precipitation_probability ?? 45}%`;
    const isHighRisk = data.current.relative_humidity_2m > 75 || (data.current.precipitation_probability ?? 0) > 60;

    res.json({
      district,
      temperature: temp,
      humidity: hum,
      rainfallProbability: `${rain} (Live Telemetry)`,
      spoilageRisk: isHighRisk ? 'HIGH FOR TUBERS & PERISHABLES' : 'MODERATE / STABLE',
      aiAdvisory: isHighRisk
        ? `High relative humidity (${hum}) detected in ${district}. Tubers & perishables face accelerated moisture decay. Move harvest to certified cold storage within 24–48 hours or liquidate immediately.`
        : `Weather in ${district} is stable (${temp}, ${hum} RH). Normal post-harvest holding conditions apply.`
    });
  } catch (err) {
    res.json({
      district,
      temperature: '29°C',
      humidity: '84%',
      rainfallProbability: '75% (Estimated)',
      spoilageRisk: 'HIGH FOR TUBERS & PERISHABLES',
      aiAdvisory: `Heavy rainfall and high relative humidity projected in ${district}. Open-air stored produce risks fungal blight rot. Dispatch lots to buyers or move to cold storage.`
    });
  }
});

// Price History & Trajectory Analytics
app.get('/api/analytics/price-history', (req, res) => {
  const crop = req.query.crop || 'Potato';
  const historyData = {
    Potato: {
      labels: ['Day -25', 'Day -20', 'Day -15', 'Day -10', 'Day -5', 'Today', 'Day +5', 'Day +10', 'Day +14'],
      historical: [1380, 1420, 1400, 1460, 1510, 1540, null, null, null],
      forecast: [null, null, null, null, null, 1540, 1620, 1690, 1750],
      mandiComparison: {
        labels: ['Dhupguri APMC', 'Siliguri Wholesale', 'Jalpaiguri Regulated', 'Falakata Hub'],
        rates: [1560, 1610, 1520, 1480]
      }
    },
    Rice: {
      labels: ['Day -25', 'Day -20', 'Day -15', 'Day -10', 'Day -5', 'Today', 'Day +5', 'Day +10', 'Day +14'],
      historical: [3050, 3100, 3120, 3150, 3180, 3190, null, null, null],
      forecast: [null, null, null, null, null, 3190, 3210, 3200, 3180],
      mandiComparison: {
        labels: ['Siliguri Wholesale', 'Jalpaiguri Regulated', 'Malda Central', 'Cooch Behar'],
        rates: [3250, 3140, 3180, 3110]
      }
    },
    Tomato: {
      labels: ['Day -25', 'Day -20', 'Day -15', 'Day -10', 'Day -5', 'Today', 'Day +5', 'Day +10', 'Day +14'],
      historical: [2100, 2250, 2380, 2420, 2460, 2410, null, null, null],
      forecast: [null, null, null, null, null, 2410, 2280, 2120, 1980],
      mandiComparison: {
        labels: ['Siliguri Wholesale', 'Alipurduar Yard', 'Jalpaiguri Yard', 'Maynaguri'],
        rates: [2450, 2520, 2280, 2310]
      }
    },
    Maize: {
      labels: ['Day -25', 'Day -20', 'Day -15', 'Day -10', 'Day -5', 'Today', 'Day +5', 'Day +10', 'Day +14'],
      historical: [2120, 2150, 2190, 2210, 2240, 2260, null, null, null],
      forecast: [null, null, null, null, null, 2260, 2320, 2380, 2420],
      mandiComparison: {
        labels: ['Dhupguri APMC', 'Cooch Behar Central', 'Maynaguri Market', 'Kishanganj'],
        rates: [2280, 2320, 2190, 2250]
      }
    }
  };

  res.json(historyData[crop] || historyData['Potato']);
});

app.get('/api/ai/price-forecast', (req, res) => {
  res.json({ currentAvg: 1540, forecast7d: 1680, trend: 'BULLISH (+13.6%)', action: 'HOLD IN NEARBY COLD STORAGE', confidence: '92%' });
});

// Lots & Marketplace
app.post('/api/lots/create', async (req, res) => {
  const db = await getDB();
  const lot = { lotId: `LOT-${Math.floor(10000 + Math.random() * 90000)}`, ...req.body, status: 'ACTIVE', createdAt: new Date().toISOString() };
  await db.run('INSERT INTO lots VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', Object.values(lot));
  res.status(201).json({ lot });
});

app.get('/api/lots', async (req, res) => {
  try {
    const db = await getDB();
    const lots = await db.all('SELECT * FROM lots ORDER BY createdAt DESC');
    res.json(lots || []);
  } catch (err) {
    res.status(500).json([]);
  }
});

// UPI QR Code Generator
app.post('/api/payments/generate-upi-qr', async (req, res) => {
  const { amount, lotId } = req.body;
  const vpa = 'upajtantram.escrow@rbi-nodal';
  const upiUrl = `upi://pay?pa=${vpa}&pn=UpajTantram_Escrow&am=${amount}&cu=INR&tn=EscrowLock_${lotId}`;

  try {
    const qrDataUrl = await QRCode.toDataURL(upiUrl, { width: 240, margin: 1 });
    res.json({
      qrDataUrl,
      vpa,
      amount,
      lotId,
      mockUtr: `UTR${Math.floor(100000000000 + Math.random() * 900000000000)}`
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR' });
  }
});

app.post('/api/trade/escrow-lock', async (req, res) => {
  const { lotId, buyerId, buyerName, bidPrice } = req.body;
  const db = await getDB();
  const lot = await db.get('SELECT * FROM lots WHERE lotId = ? AND status = "ACTIVE"', [lotId]);
  if (!lot) return res.status(404).json({ error: 'Lot unavailable' });

  await db.run('UPDATE lots SET status = "IN_ESCROW" WHERE lotId = ?', [lotId]);
  const tx = { txId: `TXN-${Math.floor(100000 + Math.random() * 900000)}`, lotId, farmerId: lot.farmerId, buyerId, buyerName, crop: lot.crop, quantity: lot.quantity, totalEscrow: bidPrice * lot.quantity, status: 'ESCROW_FUNDED', stage: 1, createdAt: new Date().toISOString() };
  await db.run('INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', Object.values(tx));
  res.status(201).json({ transaction: tx });
});

// Quality Assay Certificate PDF
app.get('/api/assay/certificate/:lotId', async (req, res) => {
  const { lotId } = req.params;
  const db = await getDB();
  const lot = await db.get('SELECT * FROM lots WHERE lotId = ?', [lotId]);

  if (!lot) return res.status(404).send('Lot not found');

  const verifyUrl = `https://upajtantram.gov.in/verify?lotId=${lot.lotId}&grade=${encodeURIComponent(lot.grade || 'Grade A')}`;
  const qrBuffer = await QRCode.toBuffer(verifyUrl, { width: 120, margin: 1 });

  const doc = new PDFDocument({ margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Assay-Certificate-${lotId}.pdf`);
  doc.pipe(res);

  doc.rect(20, 20, 570, 750).stroke('#10b981');
  doc.fillColor('#064e3b').fontSize(22).text('UPAJTANTRAM QUALITY ASSAY CERTIFICATE', 40, 55, { align: 'center' });
  doc.moveDown(2);

  doc.image(qrBuffer, 440, 100, { width: 110 });

  doc.fillColor('#0f172a').fontSize(12);
  doc.text(`Certificate No: ASSAY-${lot.lotId}`);
  doc.text(`Issued Date: ${new Date().toLocaleDateString()}`);
  doc.text(`Farmer / FPO: ${lot.farmerName} (${lot.farmerId})`);
  doc.text(`Commodity: ${lot.crop}`);
  doc.text(`Quantity: ${lot.quantity} Quintals`);
  doc.text(`Certified Grade: ${lot.grade || 'Grade A (Assayed)'}`);
  doc.moveDown();

  doc.rect(40, 280, 510, 35).fill('#ecfdf5');
  doc.fillColor('#065f46').fontSize(11).text(`STATUS: OFFICIALLY CERTIFIED FOR ESCROW PROCUREMENT`, 50, 292);

  doc.end();
});

// Receipts
app.get('/api/receipt/:txId', async (req, res) => {
  const { txId } = req.params;
  const db = await getDB();
  const tx = await db.get('SELECT * FROM transactions WHERE txId = ?', [txId]);

  if (!tx) return res.status(404).send('Transaction not found');

  const doc = new PDFDocument({ margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Receipt-${txId}.pdf`);
  doc.pipe(res);

  doc.rect(40, 40, 530, 50).fill('#10b981');
  doc.fillColor('#ffffff').fontSize(18).text('UpajTantram Trade & Escrow Receipt', 55, 55);

  doc.fillColor('#0f172a').fontSize(11).moveDown(2);
  doc.text(`Transaction ID: ${tx.txId}`);
  doc.text(`Farmer ID: ${tx.farmerId}`);
  doc.text(`Buyer: ${tx.buyerName}`);
  doc.text(`Commodity: ${tx.crop}`);
  doc.text(`Quantity: ${tx.quantity} Quintals`);
  doc.text(`Total Escrow Locked: Rs. ${Number(tx.totalEscrow).toLocaleString()}`);
  doc.text(`Status: ${tx.status}`);
  doc.end();
});

// Proximity Facilities
app.get('/api/proximity/storages', (req, res) => {
  const { district, crop, maxDistance, lat, lng } = req.query;
  const maxDist = Number(maxDistance) || 100;
  const dFilter = (district || 'All').toLowerCase();
  const cFilter = (crop || 'All').toLowerCase();

  let list = storageFacilities.map(s => {
    let dist = s.distanceKm;
    if (lat && lng) dist = getDistanceKm(Number(lat), Number(lng), s.lat, s.lng);
    return { ...s, distanceKm: dist };
  });

  list = list.filter(s => {
    const matchD = dFilter === 'all' || s.district.toLowerCase().includes(dFilter);
    const matchC = cFilter === 'all' || s.cropsSupported.some(c => c.toLowerCase() === cFilter);
    return matchD && matchC && s.distanceKm <= maxDist;
  });

  list.sort((a, b) => a.distanceKm - b.distanceKm);
  res.json(list);
});

app.get('/api/proximity/buyers', (req, res) => {
  const { district, crop, maxDistance, lat, lng } = req.query;
  const maxDist = Number(maxDistance) || 100;
  const dFilter = (district || 'All').toLowerCase();
  const cFilter = (crop || 'All').toLowerCase();

  let list = verifiedBuyers.map(b => {
    let dist = b.distanceKm;
    if (lat && lng) dist = getDistanceKm(Number(lat), Number(lng), b.lat, b.lng);
    return { ...b, distanceKm: dist };
  });

  list = list.filter(b => {
    const matchD = dFilter === 'all' || b.district.toLowerCase().includes(dFilter);
    const matchC = cFilter === 'all' || b.crop.toLowerCase() === cFilter;
    return matchD && matchC && b.distanceKm <= maxDist;
  });

  list.sort((a, b) => a.distanceKm - b.distanceKm);
  res.json(list);
});

// FPO Pooling & Logistics
app.get('/api/fpo/pools', async (req, res) => {
  const db = await getDB();
  const pools = await db.all('SELECT * FROM pooled_lots ORDER BY createdAt DESC');
  res.json(pools || []);
});

app.post('/api/fpo/create-pool', async (req, res) => {
  const { crop, targetQuantity, targetPrice, district } = req.body;
  const db = await getDB();
  const poolId = `POOL-${Math.floor(1000 + Math.random() * 9000)}`;

  await db.run(
    'INSERT INTO pooled_lots (poolId, crop, targetQuantity, currentQuantity, targetPrice, district, status, contributions, createdAt) VALUES (?, ?, ?, 0, ?, ?, "OPEN", "[]", ?)',
    [poolId, crop, targetQuantity, targetPrice, district || 'Jalpaiguri', new Date().toISOString()]
  );
  res.status(201).json({ poolId });
});

app.post('/api/fpo/contribute', async (req, res) => {
  const { poolId, farmerId, farmerName, quantity } = req.body;
  const db = await getDB();
  const pool = await db.get('SELECT * FROM pooled_lots WHERE poolId = ?', [poolId]);
  if (!pool) return res.status(404).json({ error: 'Pool not found' });

  const contributions = JSON.parse(pool.contributions || '[]');
  contributions.push({ farmerId, farmerName, quantity: Number(quantity), timestamp: new Date().toISOString() });
  const newQty = Number(pool.currentQuantity) + Number(quantity);

  await db.run('UPDATE pooled_lots SET currentQuantity = ?, contributions = ? WHERE poolId = ?', [newQty, JSON.stringify(contributions), poolId]);
  res.json({ success: true, currentQuantity: newQty });
});

app.post('/api/logistics/book', async (req, res) => {
  const { pickupDistrict, destinationMandi, vehicleType, distanceKm } = req.body;
  const db = await getDB();
  const rate = vehicleType === 'Pickup (1.5T)' ? 20 : vehicleType === 'Mini Truck (4T)' ? 32 : 50;
  const estimatedFreight = Math.round(Number(distanceKm || 30) * rate + 500);
  const bookingId = `TRK-${Math.floor(10000 + Math.random() * 90000)}`;
  const driverPhone = `+91 97330-${Math.floor(10000 + Math.random() * 90000)}`;

  await db.run(
    'INSERT INTO transport_bookings (bookingId, pickupDistrict, destinationMandi, vehicleType, estimatedFreight, driverPhone, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, "CONFIRMED", ?)',
    [bookingId, pickupDistrict, destinationMandi, vehicleType, estimatedFreight, driverPhone, new Date().toISOString()]
  );
  res.status(201).json({ bookingId, vehicleType, estimatedFreight, driverPhone });
});

app.post('/api/finance/pledge-loan', async (req, res) => {
  const { farmerId, storageId, crop, quantity, marketRate } = req.body;
  const db = await getDB();
  const produceVal = Number(quantity) * Number(marketRate || 1500);
  const sanctionedAmount = Math.round(produceVal * 0.7);
  const loanId = `LN-${Math.floor(100000 + Math.random() * 900000)}`;

  await db.run(
    'INSERT INTO pledge_loans (loanId, farmerId, storageId, crop, quantity, sanctionedAmount, interestRate, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, 7.0, "DISBURSED", ?)',
    [loanId, farmerId, storageId, crop, quantity, sanctionedAmount, new Date().toISOString()]
  );
  res.status(201).json({ loanId, sanctionedAmount, produceVal });
});

app.post('/api/disputes/raise', async (req, res) => {
  const { txId, raisedBy, reason, evidenceNotes } = req.body;
  const db = await getDB();
  const disputeId = `DISP-${Math.floor(1000 + Math.random() * 9000)}`;

  await db.run('UPDATE transactions SET status = "ESCROW_PAUSED_UNDER_DISPUTE" WHERE txId = ?', [txId]);
  await db.run(
    'INSERT INTO disputes (disputeId, txId, raisedBy, reason, evidenceNotes, status, createdAt) VALUES (?, ?, ?, ?, ?, "PENDING_REVIEW", ?)',
    [disputeId, txId, raisedBy, reason, evidenceNotes, new Date().toISOString()]
  );
  res.status(201).json({ disputeId, message: 'Dispute filed. Escrow funds paused.' });
});

// Multilingual Intelligent AI Copilot Engine
app.post('/api/ai/chat', (req, res) => {
  const { message, lang = 'en', userDistrict = 'Jalpaiguri' } = req.body;
  const q = (message || '').toLowerCase();

  const knowledge = {
    storage: {
      en: `🏬 In ${userDistrict}, Harimandir Cold Storage has 1,450 MT space at ₹2.40/Qtl/day. Baba Jalpesh Agro has 920 MT space at ₹2.60/Qtl/day. Check the 'Location Radar' tab for direct directions.`,
      bn: `🏬 ${userDistrict}-তে হরিমন্দির কোল্ড স্টোরেজে ১,৪৫০ মেট্রিক টন জায়গা খালি আছে (প্রতি কুইন্টাল প্রতিদিন ₹২.৪০)। 'Location Radar' ট্যাবে ম্যাপ দেখুন।`,
      hi: `🏬 ${userDistrict} में हरि मंदिर कोल्ड स्टोरेज में 1,450 मीट्रिक टन जगह उपलब्ध है (₹2.40/क्विंटल/दिन)। मैप के लिए 'Location Radar' टैब देखें।`
    },
    weather: {
      en: `⚠️ High moisture & rainfall warning in ${userDistrict} (75% rain probability). Perishable tubers and tomatoes risk fungal blight rot. Move produce to cold storage or sell within 24–48 hours.`,
      bn: `⚠️ ${userDistrict}-তে বৃষ্টির সম্ভাবনা ৭৫% এবং আর্দ্রতা অতিরিক্ত বেশি। আলু ও টমেটোতে পচন ধরার আশঙ্কা রয়েছে। দ্রুত হিমাগারে রাখুন অথবা ৪৮ ঘণ্টার মধ্যে বিক্রি করুন।`,
      hi: `⚠️ ${userDistrict} में 75% बारिश और अधिक नमी की चेतावनी है। खुले में रखे आलू और टमाटर में सड़न का खतरा है। इन्हें तुरंत कोल्ड स्टोर में रखें या 24-48 घंटे में बेचें।`
    },
    loan: {
      en: `💳 Under the e-NWR scheme, you can pledge stored produce at accredited cold stores to receive an instant 70% cash advance at just 7.0% p.a. interest. Apply in the 'Storage Loans' tab.`,
      bn: `💳 e-NWR প্রকল্পের মাধ্যমে হিমাগারে রাখা ফসলের রসিদ দেখিয়ে মাত্র ৭% সুদে মূল্যের ৭০% নগদ লোন পাওয়া যায়। 'Storage Loans' ট্যাবে গিয়ে আবেদন করুন।`,
      hi: `💳 e-NWR स्कीम के तहत आप कोल्ड स्टोर में रखे माल पर 7% ब्याज दर पर 70% तक का तुरंत कैश एडवांस ले सकते हैं। 'Storage Loans' टैब में आवेदन करें।`
    },
    escrow: {
      en: `🛡️ UpajTantram uses an RBI Nodal Escrow system. When a buyer places an order, funds are locked in escrow. Payment is released to the farmer only after physical weighbridge and quality assay verification.`,
      bn: `🛡️ উপজতন্ত্রমে আরবিআই নোডাল এসক্রো ব্যবস্থা রয়েছে। ক্রেতার টাকা আগে এসক্রোতে জমা থাকে এবং ফসল ওজন ও গুণমান যাচাইয়ের পরেই চাষির ব্যাংকে টাকা পাঠানো হয়।`,
      hi: `🛡️ उपजतंत्रम् आरबीआई नोडल एस्क्रो पर काम करता है। खरीदार के पैसे पहले एस्क्रो में सुरक्षित होते हैं और माल की सही जांच के बाद ही किसान को भुगतान होता है।`
    },
    pooling: {
      en: `👥 Smallholder aggregation: Combine your 5–10 Quintal harvest with fellow farmers under the 'FPO Pooling' tab to build 100+ Quintal wholesale truckloads, reducing transport costs by ~35%.`,
      bn: `👥 ছোট চাষিদের জন্য দলগত বিক্রি: 'FPO Pooling' ট্যাবে গিয়ে ৫-১০ কুইন্টাল ফসল একত্র করে ১০০ কুইন্টালের বড় লট তৈরি করুন। এতে গাড়ি ভাড়া ৩৫% পর্যন্ত কমবে।`,
      hi: `👥 छोटे किसान 'FPO Pooling' टैब में अपनी 5-10 क्विंटल उपज को मिलाकर 100+ क्विंटल का थोक ट्रक लोड बना सकते हैं, जिससे भाड़ा 35% तक कम हो जाता है।`
    },
    mandi: {
      en: `📈 Current benchmark rates in North Bengal: Potato is ₹1,540/Qtl (Bullish trend, projected ₹1,680), Tomato is ₹2,410/Qtl, and Rice is ₹3,190/Qtl.`,
      bn: `📈 বর্তমান পাইকারি বাজার দর: আলু ₹১,৫৪০/কুইন্টাল (১৪ দিনে ₹১,৬৮০ হওয়ার পূর্বাভাস), টমেটো ₹২,৪১০/কুইন্টাল, এবং ধান ₹৩,১৯০/কুইন্টাল।`,
      hi: `📈 वर्तमान मंडी भाव: आलू ₹1,540/क्विंटल (आगे ₹1,680 तक जाने का अनुमान), टमाटर ₹2,410/क्विंटल, और धान ₹3,190/क्विंटल।`
    },
    default: {
      en: `I am your UpajTantram AI Copilot. Ask me about nearby cold storage facilities, weather rot warnings, e-NWR pledge loans, live mandi rates, or how UPI escrow secures your harvest sales.`,
      bn: `আমি আপনার উপজতন্ত্রম এআই সহকারী। হিমাগারের সন্ধান, আবহাওয়ার সতর্কতা, কম সুদে লোন, বা ফসলের দাম জানতে যেকোনো প্রশ্ন করুন।`,
      hi: `मैं आपका उपजतंत्रम् एआई सहायक हूँ। नजदीकी कोल्ड स्टोरेज, मौसम के जोखिम, फसल पर ऋण, मंडी भाव या एस्क्रो सुरक्षा के बारे में कुछ भी पूछें।`
    }
  };

  let activeLang = lang;
  if (/[\u0980-\u09FF]/.test(q)) activeLang = 'bn';
  else if (/[\u0900-\u097F]/.test(q)) activeLang = 'hi';

  let replyKey = 'default';

  if (q.includes('storage') || q.includes('cold') || q.includes('হিমাগার') || q.includes('স্টোরেজ') || q.includes('स्टोर') || q.includes('कोल्ड') || q.includes('भंडारण')) {
    replyKey = 'storage';
  } else if (q.includes('weather') || q.includes('rain') || q.includes('rot') || q.includes('বৃষ্টি') || q.includes('পচন') || q.includes('আবহাওয়া') || q.includes('बारिश') || q.includes('मौसम') || q.includes('सड़न')) {
    replyKey = 'weather';
  } else if (q.includes('loan') || q.includes('credit') || q.includes('advance') || q.includes('লোন') || q.includes('ঋণ') || q.includes('টাকা') || q.includes('ऋण') || q.includes('लोन') || q.includes('पैसा') || q.includes('कर्ज')) {
    replyKey = 'loan';
  } else if (q.includes('escrow') || q.includes('payment') || q.includes('safe') || q.includes('টাকা পাব') || q.includes('নিরাপদ') || q.includes('भुगतान') || q.includes('सुरक्षा') || q.includes('एस्क्रो')) {
    replyKey = 'escrow';
  } else if (q.includes('fpo') || q.includes('pool') || q.includes('group') || q.includes('দলগত') || q.includes('একত্র') || q.includes('समूह') || q.includes('झुंड')) {
    replyKey = 'pooling';
  } else if (q.includes('price') || q.includes('rate') || q.includes('mandi') || q.includes('দাম') || q.includes('দর') || q.includes('মন্ডি') || q.includes('भाव') || q.includes('रेट')) {
    replyKey = 'mandi';
  }

  const selectedCategory = knowledge[replyKey] || knowledge['default'];
  const reply = selectedCategory[activeLang] || selectedCategory['en'];

  res.json({ reply, detectedLang: activeLang });
});

async function initDB() {
  const db = await getDB();
  try { await db.exec('ALTER TABLE lots ADD COLUMN farmerPhone TEXT;'); } catch (e) {}
  try { await db.exec('ALTER TABLE lots ADD COLUMN photoUrl TEXT;'); } catch (e) {}
  return db;
}

const PORT = process.env.PORT || 5000;
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`🌾 UpajTantram (उपजतंत्रम्) running on port ${PORT}`));
});