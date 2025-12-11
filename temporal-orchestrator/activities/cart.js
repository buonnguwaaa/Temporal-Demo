const axios = require("axios");

module.exports = {
    async clearCart(cartId) {
        const res = await axios.delete(`http://cart-service:4000/cart/${cartId}`);
        return res.data;
    }
}