// ===================================
// workflows/orderWorkflow.js
// ===================================
import { 
  proxyActivities, 
  defineSignal, 
  setHandler, 
  condition,
  workflowInfo
} from "@temporalio/workflow";

const {
  reserveStock,
  commitStock,
  releaseStock
} = proxyActivities({
  startToCloseTimeout: "10 seconds",
  taskQueue: "ORDER_QUEUE"
});

const { clearCart } = proxyActivities({
  startToCloseTimeout: "10 seconds",
  taskQueue: "ORDER_QUEUE"
});

const { pay, refund } = proxyActivities({
  startToCloseTimeout: "10 seconds",
  taskQueue: "ORDER_QUEUE"
});

// SIGNALS
export const paymentSignal = defineSignal("payment");
export const reservationExpiredSignal = defineSignal("reservationExpired");

export async function orderWorkflow(cartId, items) {
  const { workflowId } = workflowInfo();
  const reservationId = `resv-${cartId}-${Date.now()}`;

  console.log("Workflow started", { orderId: workflowId });

  //
  // 1. Reserve stock
  //
  const resv = await reserveStock(workflowId, reservationId, items);
  if (!resv.success) {
    return { success: false, reason: "OUT_OF_STOCK" };
  }

  console.log("Stock reserved:", reservationId);

  //
  // 2. Wait for payment OR expiration signal
  //
  let paymentData = null;
  let expiredData = null;

  setHandler(paymentSignal, (data) => {
    console.log("Received payment signal");
    paymentData = data;
  });

  setHandler(reservationExpiredSignal, (data) => {
    console.log("Received expiration signal:", data);
    expiredData = data;
  });

  // Wait cho 1 trong 2 events
  await condition(() => paymentData !== null || expiredData !== null);

  // CASE 1: EXPIRED TRƯỚC - GỌI RELEASE ACTIVITY
  if (expiredData) {
    console.log("Reservation expired");
    
    await releaseStock(reservationId);
    
    return { 
      success: false, 
      reason: "RESERVATION_EXPIRED",
      message: "Stock reservation timed out"
    };
  }

  // CASE 2: PAYMENT RECEIVED
  console.log("Payment received - processing...");

  //
  // 3. Process Payment
  //
  let payResult = null;

  try {
    payResult = await pay(paymentData.userId, paymentData.amount);

    if (!payResult.ok) {
      throw new Error("Payment failed");
    }

    console.log("Payment successful:", payResult.transactionId);

    //
    // 4. Commit inventory
    //
    const commit = await commitStock(reservationId);
    if (!commit.success) {
      throw new Error("Commit stock failed");
    }

    console.log("Stock committed");

    //
    // 5. Clear cart
    //
    await clearCart(cartId);

    console.log("Cart cleared - order complete");

    return {
      success: true,
      transactionId: payResult.transactionId
    };

  } catch (err) {
    //
    // COMPENSATION: GỌI RELEASE ACTIVITY
    //
    console.log("Error occurred - compensating...", err.message);
    
    if (payResult?.transactionId) {
      console.log("Refunding payment:", payResult.transactionId);
      await refund(payResult.transactionId);
    }

    console.log("Releasing stock via activity");
    await releaseStock(reservationId);

    return {
      success: false,
      reason: "PAYMENT_FAILED",
      message: err.message
    };
  }
}