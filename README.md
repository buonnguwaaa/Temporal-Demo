## Order Workflow: 
1. Add product to cart 
2. Checkout → Start workflow 
3. Check inventory, reserve stocks
4. Wait for payment process  
5. User process payment for order. If success update inventory and remove current cart. 
6. If we fail at any step, release stock → Orchestrator rollbacks & compensates previous steps 

## Workflow Diagram:
```mermaid
    graph TD
        Start([User adds items to cart]) --> AddItems[POST /cart/123/add]
        AddItems --> Checkout[POST /cart/123/checkout]
        Checkout --> StartWF[Start Temporal Workflow]
        
        StartWF --> Reserve[Reserve Inventory]
        Reserve --> CheckStock{Stock<br/>Available?}
        
        CheckStock -->|No| ReturnStock[Return OUT_OF_STOCK]
        CheckStock -->|Yes| StockReserved[✓ Stock Reserved]
        
        StockReserved --> WaitPay[Wait for Payment Signal]
        WaitPay --> UserPay[User: POST /cart/123/pay]
        UserPay --> ProcessPay[Process Payment]
        
        ProcessPay --> CheckPay{Payment<br/>Success?}
        
        CheckPay -->|Yes| Success[✓ Payment Complete]
        Success --> Commit[Commit Inventory]
        Commit --> ClearCart[Clear Cart]
        ClearCart --> Done([Order Complete ✅])
        
        CheckPay -->|No| CompStart[Start Compensation]
        CompStart --> Refund[Refund Payment<br/>if charged]
        Refund --> Release[Release Reserved Stock]
        Release --> Failed([Order Failed ❌<br/>All changes rolled back])
        
        ReturnStock --> EndFail([Checkout Failed])
        
        style Success fill:#90EE90
        style Done fill:#32CD32
        style CompStart fill:#FFB6C1
        style Failed fill:#FF6B6B
        style StockReserved fill:#87CEEB
        style Commit fill:#90EE90
```

## Recording Scenarios
### Scenario 1: Happy Case 
1. User adds products to cart
2. User checkouts
3. User processes payment within the reservation time
4. Done

### Scenario 2: Reservation Timeout
1. User add products to cart
2. User checkouts
3. User does not process payment within the reservation time
4. Done

### Scenario 3: Internet Connection Interrupted
1. User add products to cart
2. User checkouts
3. User processes payment but get disconnected due to network issues
4. Temporal performs retries
5. Retry successful
6. Done

### Scenario 4: Out of stock
1. User add products to cart
2. User checkouts
3. Temporal check available stocks from inventory service
4. Inform "Out of stock"
5. Done
