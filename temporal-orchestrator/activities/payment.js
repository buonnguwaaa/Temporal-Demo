const axios = require("axios");

module.exports = {
  async pay(userId, amount) {
    try {
      const res = await axios.post(
        "http://payment-service:4002/pay",
        { userId, amount },
      );
      return res.data;

    } catch (err) {
      // ❗ Business error (HTTP 400)
      if (err.response && err.response.status === 400) {
        return err.response.data; // không throw
      }

      // ❗ System error → Temporal sẽ retry
      throw err;
    }
  },

  async refund(transactionId) {
    const res = await axios.post("http://payment-service:4002/refund", { transactionId });
    return res.data;
  }
};
    