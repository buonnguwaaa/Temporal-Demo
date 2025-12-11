.PHONY: start start-cart start-inventory start-payment

start: start-cart start-inventory start-payment

start-cart:
	@echo "Starting cart service..."
	node ./cart-service/src/server.js &

start-inventory:
	@echo "Starting inventory service..."
	node ./inventory-service/src/server.js &
start-payment:
	@echo "Starting payment service..."
	node ./payment-service/src/server.js &