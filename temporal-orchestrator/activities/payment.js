const axios = require("axios");

module.exports = {
  async pay(userId, amount) {
    const res = await axios.post("http://payment-service:4002/pay", { userId, amount });
    return res.data;
  },

  async refund(transactionId) {
    const res = await axios.post("http://payment-service:4002/refund", { transactionId });
    return res.data;
  }
};
    