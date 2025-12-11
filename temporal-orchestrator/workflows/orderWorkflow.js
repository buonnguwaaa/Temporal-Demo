// workflows/orderWorkflow.js
import { proxyActivities, defineSignal, setHandler, condition, workflowInfo } from "@temporalio/workflow";

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

// signal from /cart/:id/pay
export const paymentSignal = defineSignal("payment");
export const reservationExpiredSignal = defineSignal("reservationExpired");

export async function orderWorkflow( cartId, items) {
  const { workflowId } = workflowInfo();
  const orderId = workflowId;
  console.log("Workflow started", { orderId });

  const reservationId = `resv-${cartId}-${Date.now()}`;

  //
  // 1. Reserve stock
  //
  const resv = await reserveStock(workflowId, reservationId, items);
  if (!resv.success) {
    return { success: false, reason: "OUT_OF_STOCK" };
  }

  //
  // 2. Wait payment
  //
  let paymentData = null;
  let expired = false;
  setHandler(paymentSignal, (data) => {
    paymentData = data;
  });
  setHandler(reservationExpiredSignal, () => {
    expired = true;
  });

  await condition(() => paymentData || expired);
  
  if (expired) {
    return { success: false, reason: "RESERVATION_EXPIRED" };
  }
  //
  // 3. Process Payment
  //
  let payResult = null;

  try {
    payResult = await pay(paymentData.userId, paymentData.amount);

    if (!payResult.ok) {
      throw new Error("Payment failed");
    }

    //
    // 4. COMMIT INVENTORY
    //
    const commit = await commitStock(reservationId);
    if (!commit.success) throw new Error("Commit stock failed");

    //
    // 5. CLEAR THE CART
    //
    await clearCart(cartId);

    return {
      success: true,
      transactionId: payResult.transactionId
    };

  } catch (err) {
    //
    // COMPENSATION
    //
    if (payResult?.transactionId) {
      await refund(payResult.transactionId);
    }

    await releaseStock(reservationId);

    return {
      success: false,
      reason: "FAILED",
      message: err.message
    };
  }
}
