// ===================================
// inventory-service.js (SIGNAL ONLY - NO AUTO RELEASE)
// ===================================
const express = require("express");
const { Connection, WorkflowClient } = require("@temporalio/client");

const app = express();
app.use(express.json());

let inventory = {
  "SKU-1": { available: 10, reserved: 0, sold: 0 },
  "SKU-2": { available: 2, reserved: 0, sold: 0 }
};

let reservations = {};

// TEMPORAL CLIENT
let client;

async function initTemporalClient() {
  const connection = await Connection.connect({
    address: "temporal:7233",
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
    createdAt: Date.now(),
    expiresAt: Date.now() + 40000, // 20s
    committed: false,
    released: false
  };

  // CHỈ SIGNAL - KHÔNG RELEASE
  const timerId = setTimeout(async () => {
    const r = reservations[reservationId];
    if (!r || r.committed || r.released) {
      return; // Đã xử lý rồi
    }

    console.log("RESERVATION EXPIRED - Signaling workflow:", reservationId);

    // CHỈ SIGNAL - ĐỂ WORKFLOW TỰ GỌI RELEASE
    try {
      const handle = client.getHandle(r.orderId);
      await handle.signal("reservationExpired", { reservationId });
      console.log("✓ Signaled workflow:", r.orderId);
    } catch (err) {
      console.error("✗ Failed to signal workflow:", err.message);
    }
  }, 40000);

  // Lưu timerId để có thể cancel
  reservations[reservationId].timerId = timerId;

  res.json({ success: true });
});

// ==========================
// 2. COMMIT STOCK
// ==========================
app.post("/commit", (req, res) => {
  console.log("COMMIT STOCK:", req.body);
  const { reservationId } = req.body;

  const r = reservations[reservationId];
  if (!r) {
    return res.json({
      success: false,
      message: "Reservation not found"
    });
  }

  if (r.released) {
    return res.json({
      success: false,
      message: "Reservation already released"
    });
  }

  // Cancel timeout
  if (r.timerId) {
    clearTimeout(r.timerId);
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
// 3. RELEASE STOCK (Được GỌI BỞI WORKFLOW)
// ==========================
app.post("/release", (req, res) => {
  console.log("RELEASE STOCK:", req.body);
  const { reservationId } = req.body;

  const r = reservations[reservationId];
  if (!r) {
    // Idempotent: OK nếu đã release
    return res.json({ success: true, message: "Already released" });
  }

  if (r.committed) {
    return res.json({
      success: false,
      message: "Cannot release - already committed"
    });
  }

  // Cancel timeout nếu còn
  if (r.timerId) {
    clearTimeout(r.timerId);
  }

  // Hoàn trả stock
  for (const it of r.items) {
    inventory[it.sku].available += it.qty;
    inventory[it.sku].reserved -= it.qty;
  }

  r.released = true;
  delete reservations[reservationId];

  res.json({ success: true });
});

// ==========================
// DEBUG
// ==========================
app.get("/inventory", (req, res) => {
  res.json({
    inventory,
    reservations: Object.keys(reservations).map(id => ({
      id,
      orderId: reservations[id].orderId,
      items: reservations[id].items,
      committed: reservations[id].committed,
      released: reservations[id].released,
      expiresIn: Math.max(0, reservations[id].expiresAt - Date.now())
    }))
  });
});

app.listen(4001, () => console.log("Inventory Service on 4001"));