const express = require("express");

const app = express();
app.use(express.json());

// fake payment processing
app.post("/pay", async (req, res) => {
  const { userId, amount } = req.body;

  console.log("PAYMENT REQUEST:", { userId, amount });

  // simulate business error
  if (amount <= 50) {
    return res.status(400).json({
      ok: false,
      transactionId: Date.now().toString(),
      message: "Invalid amount"
    });
  }

  res.json({
    ok: true,
    message: "Payment processed",
    transactionId: Date.now().toString()
  });
});

// compensation: refund
app.post("/refund", async (req, res) => {
  const { transactionId } = req.body;

  console.log("REFUND:", { transactionId });

  res.json({
    ok: true,
    refunded: true
  });
});

const PORT = 4002;
app.listen(PORT, () => {
  console.log("Payment service running on port", PORT);
});
