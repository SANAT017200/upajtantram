const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

let dbInstance = null;

async function getDB() {
  if (dbInstance) return dbInstance;

  dbInstance = await open({
    filename: path.join(__dirname, 'upajtantram.db'),
    driver: sqlite3.Database
  });

  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT UNIQUE,
      pin TEXT,
      role TEXT,
      state TEXT,
      district TEXT,
      location TEXT,
      verified INTEGER,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS lots (
      lotId TEXT PRIMARY KEY,
      farmerId TEXT,
      farmerName TEXT,
      farmerPhone TEXT,
      crop TEXT,
      grade TEXT,
      quantity REAL,
      expectedPrice REAL,
      location TEXT,
      photoUrl TEXT,
      status TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS transactions (
      txId TEXT PRIMARY KEY,
      lotId TEXT,
      farmerId TEXT,
      buyerId TEXT,
      buyerName TEXT,
      crop TEXT,
      quantity REAL,
      totalEscrow REAL,
      status TEXT,
      stage INTEGER,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS pooled_lots (
      poolId TEXT PRIMARY KEY,
      crop TEXT,
      targetQuantity REAL,
      currentQuantity REAL,
      targetPrice REAL,
      district TEXT,
      status TEXT,
      contributions TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS transport_bookings (
      bookingId TEXT PRIMARY KEY,
      pickupDistrict TEXT,
      destinationMandi TEXT,
      vehicleType TEXT,
      estimatedFreight REAL,
      driverPhone TEXT,
      status TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS pledge_loans (
      loanId TEXT PRIMARY KEY,
      farmerId TEXT,
      storageId TEXT,
      crop TEXT,
      quantity REAL,
      sanctionedAmount REAL,
      interestRate REAL,
      status TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS disputes (
      disputeId TEXT PRIMARY KEY,
      txId TEXT,
      raisedBy TEXT,
      reason TEXT,
      evidenceNotes TEXT,
      status TEXT,
      createdAt TEXT
    );
  `);

  return dbInstance;
}

module.exports = { getDB };