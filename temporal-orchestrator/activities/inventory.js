// temporal-orchestrator/activities/inventoryActivities.js
const axios = require("axios");

// Inventory service URL
const INV_URL = "http://inventory-service:4001";

module.exports = {
  async reserveStock(orderId, reservationId, items) {
    const res = await axios.post(`${INV_URL}/reserve`, {
      orderId,
      reservationId,
      items
    });

  return res.data; // { success: true/false }
  },
  async commitStock(reservationId) {
    const res = await axios.post(`${INV_URL}/commit`, {
      reservationId
    });

    return res.data;
  },

  async releaseStock(reservationId) {
    const res = await axios.post(`${INV_URL}/release`, {
      reservationId
    });

    return res.data;
  },

  async checkReservation(reservationId) {
    const res = await axios.get(`${INV_URL}/reservation/${reservationId}`);
    return res.data;
  }
}
