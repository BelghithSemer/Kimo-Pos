// Add authentication wrapper
const originalFetch = window.fetch;
window.fetch = function(url, options = {}) {
    if (url.startsWith('/api/')) {
        options.headers = {
            ...options.headers,
            ...getAuthHeaders()
        };
    }
    return originalFetch(url, options);
};

document.addEventListener('DOMContentLoaded', () => {
    let currentSale = [];
    
    // Update sale count
    function updateSaleCount() {
        const saleCount = document.getElementById('sale-count');
        if (saleCount) {
            saleCount.textContent = currentSale.length;
        }
    }
    
    // Currency formatter
    function formatCurrency(amount) {
        return `${amount.toFixed(2)} TND`;
    }
    
    // Load products
    function loadProducts() {
        fetch('/api/products')
            .then(response => response.json())
            .then(products => {
                const productGrid = document.getElementById('product-grid');
                productGrid.innerHTML = '';
                
                products.forEach(product => {
                    const col = document.createElement('div');
                    col.className = 'col-6 col-md-4 col-lg-3';
                    col.innerHTML = `
                        <button class="btn btn-primary btn-product" 
                            data-id="${product._id}" 
                            data-name="${product.name}" 
                            data-price="${product.price}"
                            data-base-price="${product.base_price || 0}">
                            ${product.name}<br>
                            <strong>${formatCurrency(product.price)}</strong>
                        </button>
                    `;
                    productGrid.appendChild(col);
                });

                // Add event listeners to buttons
                document.querySelectorAll('.btn-product').forEach(button => {
                    button.addEventListener('click', () => {
                        const product = {
                            id: button.getAttribute('data-id'),
                            name: button.getAttribute('data-name'),
                            price: parseFloat(button.getAttribute('data-price')),
                            base_price: parseFloat(button.getAttribute('data-base-price'))
                        };
                        addToSale(product);
                    });
                });
            })
            .catch(error => console.error('Error loading products:', error));
    }

    function addToSale(product) {
        currentSale.push(product);
        renderSale();
        updateSaleCount();
    }

    function renderSale() {
        const saleList = document.getElementById('current-sale');
        saleList.innerHTML = '';
        
        let total = 0;
        
        currentSale.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'list-group-item';
            li.innerHTML = `
                <span>${item.name}</span>
                <span>
                    <strong>${formatCurrency(item.price)}</strong>
                    <span class="remove-item ms-2" data-index="${index}">✖</span>
                </span>
            `;
            saleList.appendChild(li);
            total += item.price;
        });
        
        // Update total
        document.getElementById('total-amount').textContent = formatCurrency(total);
        
        // Add event listeners to remove items
        document.querySelectorAll('.remove-item').forEach(span => {
            span.addEventListener('click', () => {
                const index = parseInt(span.getAttribute('data-index'));
                currentSale.splice(index, 1);
                renderSale();
                updateSaleCount();
            });
        });
    }

    // Load today's orders
    function loadTodaysOrders() {
        fetch('/api/orders/today')
            .then(response => response.json())
            .then(orders => {
                const ordersList = document.getElementById('orders-list');
                const ordersCount = document.getElementById('orders-count');
                
                ordersList.innerHTML = '';
                ordersCount.textContent = orders.length;
                
                if (orders.length === 0) {
                    ordersList.innerHTML = '<p class="text-muted text-center p-3">No orders yet today</p>';
                    return;
                }
                
                orders.forEach(order => {
                    const orderTime = new Date(order.timestamp).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    });
                    const statusClass = order.status === 'paid' ? 'success' : 'warning';
                    const statusText = order.status === 'paid' ? 'Paid' : 'Unpaid';
                    
                    const orderDiv = document.createElement('div');
                    orderDiv.className = 'order-item mb-2 p-2 border rounded';
                    orderDiv.innerHTML = `
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <small class="text-muted">${orderTime}</small><br>
                                <strong>${order.order_number}</strong><br>
                                <span class="currency">${order.total.toFixed(2)}</span>
                            </div>
                            <button class="btn btn-sm btn-${statusClass} order-status status-btn" 
                                data-order-id="${order._id}" 
                                data-status="${order.status}">
                                ${statusText}
                            </button>
                        </div>
                    `;
                    ordersList.appendChild(orderDiv);
                });
                
                // Add event listeners to status buttons
                document.querySelectorAll('.status-btn').forEach(button => {
                    button.addEventListener('click', function(e) {
                        e.stopPropagation();
                        const orderId = this.getAttribute('data-order-id');
                        const currentStatus = this.getAttribute('data-status');
                        const newStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
                        updateOrderStatus(orderId, newStatus);
                    });
                });
            })
            .catch(error => console.error('Error loading orders:', error));
    }

    // Update order status
    function updateOrderStatus(orderId, status) {
        fetch(`/api/orders/${orderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to update order status');
            }
            return response.json();
        })
        .then(data => {
            loadTodaysOrders(); // Reload orders to show updated status
        })
        .catch(error => {
            console.error('Error updating order status:', error);
            alert('Error updating order status!');
        });
    }

    // Clear sale button
    document.getElementById('clear-sale').addEventListener('click', () => {
        if (currentSale.length > 0 && confirm('Are you sure you want to clear the current sale?')) {
            currentSale = [];
            renderSale();
            updateSaleCount();
        }
    });

    // Complete order button
    document.getElementById('complete-order').addEventListener('click', () => {
        if (currentSale.length === 0) {
            alert('No items in current sale!');
            return;
        }
        
        // Disable button to prevent double-click
        const completeBtn = document.getElementById('complete-order');
        completeBtn.disabled = true;
        completeBtn.textContent = 'Processing...';
        
        fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: currentSale })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to create order');
            }
            return response.json();
        })
        .then(order => {
            alert(`Order ${order.order_number} created successfully!\nTotal: ${formatCurrency(order.total)}`);
            currentSale = [];
            renderSale();
            updateSaleCount();
            loadTodaysOrders(); // Reload orders list
        })
        .catch(error => {
            console.error('Error creating order:', error);
            alert('Error creating order! Please try again.');
        })
        .finally(() => {
            // Re-enable button
            completeBtn.disabled = false;
            completeBtn.textContent = 'Complete Order';
        });
    });

    // Initial load
    loadProducts();
    loadTodaysOrders();
    renderSale(); // Initialize empty sale display
    updateSaleCount();
    
    // Refresh orders every 30 seconds
    setInterval(loadTodaysOrders, 30000);
});