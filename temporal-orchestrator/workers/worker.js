const { Worker, NativeConnection } = require("@temporalio/worker");
const path = require("path");

async function run() {
  const connection = await NativeConnection.connect({
    address: "temporal:7233",   // <--- quan trọng
  });

  const worker = await Worker.create({
    taskQueue: "ORDER_QUEUE",
    workflowsPath: path.join(__dirname, "../workflows"),
    activities: {
      ...require("../activities/cart"),
      ...require("../activities/inventory"),
      ...require("../activities/payment"),
    },
    connection,
  });

  console.log("Saga Orchestrator Worker started...");
  await worker.run();
}

run().catch(console.error);
