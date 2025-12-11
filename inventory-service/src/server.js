const express = require("express");
const { Connection, WorkflowClient } = require("@temporalio/client");

const app = express();
app.use(express.json());

// ==========================
// REALISTIC INVENTORY MODEL
// ==========================
let inventory = {
  "SKU-1": { available: 10, reserved: 0, sold: 0 },
  "SKU-2": { available: 2, reserved: 0, sold: 0 }
};

// Lưu giữ reservation pending theo ID
let reservations = {};

// CONNECT TO TEMPORAL
let client;

async function initTemporalClient() {
  const connection = await Connection.connect({
    address: "temporal:7233", // inside docker network
  });

  client = new WorkflowClient({ connection });
}
initTemporalClient();

// ==========================
// 1. RESERVE STOCK
// ==========================
app.post("/reserve", (req, res) => {
  console.log("RESERVE REQUEST:", req.body);
  const { orderId, reservationId, items } = req.body;

  // Kiểm tra tồn kho
  for (const it of items) {
    const product = inventory[it.sku];
    if (!product || product.available < it.qty) {
      return res.json({
        success: false,
        message: `Out of stock: ${it.sku}`
      });
    }
  }

  // Giảm available, tăng reserved
  for (const it of items) {
    inventory[it.sku].available -= it.qty;
    inventory[it.sku].reserved += it.qty;
  }

  // Lưu reservation
  reservations[reservationId] = {
    orderId,
    items,
    expiresAt: Date.now() + 20000, // 20s timeout
    committed: false
  };

  // Auto-expire reservation
  setTimeout(async () => {
    const r = reservations[reservationId];
    if (r && !r.committed) {
      console.log("AUTO-RELEASE due to timeout:", reservationId);

      for (const it of r.items) {
        inventory[it.sku].available += it.qty;
        inventory[it.sku].reserved -= it.qty;
      }

      delete reservations[reservationId];

      const handle = client.getHandle(r.orderId);
      await handle.signal("reservationExpired");
    }
  }, 20000);

  res.json({ success: true });
});

// ==========================
// 2. COMMIT STOCK (PAYMENT SUCCESS)
// ==========================
app.post("/commit", (req, res) => {
  console.log("COMMIT STOCK:", req.body);
  const { reservationId } = req.body;

  const r = reservations[reservationId];
  if (!r) {
    return res.json({
      success: false,
      message: "Reservation expired or not found"
    });
  }

  // Chuyển reserved → sold
  for (const it of r.items) {
    inventory[it.sku].reserved -= it.qty;
    inventory[it.sku].sold += it.qty;
  }

  r.committed = true;
  delete reservations[reservationId];

  res.json({ success: true });
});

// ==========================
// 3. RELEASE STOCK (ROLLBACK)
// ==========================
app.post("/release", (req, res) => {
  console.log("RELEASE REQUEST:", req.body);
  const { reservationId } = req.body;

  const r = reservations[reservationId];
  if (!r) {
    return res.json({
      success: false,
      message: "Reservation not found"
    });
  }

  for (const it of r.items) {
    inventory[it.sku].available += it.qty;
    inventory[it.sku].reserved -= it.qty;
  }

  delete reservations[reservationId];

  res.json({ success: true });
});

// ==========================
// DEBUG: GET INVENTORY
// ==========================
app.get("/inventory", (req, res) => {
  res.json(inventory);
});

app.listen(4001, () => console.log("Inventory Service running on 4001"));
