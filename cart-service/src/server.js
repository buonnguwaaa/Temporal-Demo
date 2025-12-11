const express = require("express");
const { Connection, WorkflowClient } = require("@temporalio/client");

const app = express();
app.use(express.json());

let carts = {};
let orders = {};

// CONNECT TO TEMPORAL
let client;

async function initTemporalClient() {
  const connection = await Connection.connect({
    address: "temporal:7233", // inside docker network
  });

  client = new WorkflowClient({ connection });
}
initTemporalClient();


// 1. ADD ITEM
app.post("/cart/:id/add", (req, res) => {
  const { id } = req.params;

  carts[id] = carts[id] || [];
  carts[id].push(req.body);

  res.json({ ok: true, items: carts[id] });
});


// 2. CHECKOUT → START WORKFLOW
app.post("/cart/:id/checkout", async (req, res) => {
  const { id } = req.params;
  const items = carts[id] || [];

  if (items.length === 0) {
    return res.json({ success: false, message: "EMPTY_CART" });
  }

  const orderId = `order-${id}-${Date.now()}`;
  orders[id] = orderId;

  const handle = await client.start("orderWorkflow", {
    workflowId: orderId,
    taskQueue: "ORDER_QUEUE",
    args: [id, items],
  });

  res.json({ ok: true, workflowId: handle.workflowId });
});


// 3. PAYMENT → SEND SIGNAL
app.post("/cart/:id/pay", async (req, res) => {
  const { id } = req.params;
  const { userId, amount } = req.body;

  const orderId = orders[id];
  const handle = await client.getHandle(orderId);

  await handle.signal("payment", { userId, amount });

  const result = await handle.result();

  if (result.success) delete carts[id];

  res.json(result);
});


// 4. DELETE CART
app.delete("/cart/:id", (req, res) => {
  const { id } = req.params;
  if (!carts[id]) return res.json({ ok: false, message: "Cart not found" });

  delete carts[id];
  res.json({ ok: true, message: "Cart removed" });
});

app.listen(4000, () => console.log("Cart Service running on 4000"));
