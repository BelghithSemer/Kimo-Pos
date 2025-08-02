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
    const orderDateInput = document.getElementById('order-date');
    const selectedDateSpan = document.getElementById('selected-date');
    const orderDetailsModal = new bootstrap.Modal(document.getElementById('orderDetailsModal'));
    
    // Set today's date as default
    orderDateInput.value = new Date().toISOString().split('T')[0];
    selectedDateSpan.textContent = new Date().toLocaleDateString();
    
    // Currency formatter
    function formatCurrency(amount) {
        return `${amount.toFixed(2)} TND`;
    }
    
    // Load orders for selected date
    function loadOrders(date) {
        fetch(`/api/orders/date/${date}`)
            .then(response => response.json())
            .then(orders => {
                const container = document.getElementById('orders-container');
                const unpaidCount = document.getElementById('unpaid-count');
                const paidCount = document.getElementById('paid-count');
                
                let unpaid = 0;
                let paid = 0;
                
                if (orders.length === 0) {
                    container.innerHTML = '<p class="text-center text-muted p-4">No orders for this date</p>';
                    unpaidCount.textContent = '0';
                    paidCount.textContent = '0';
                    return;
                }
                
                let html = '<div class="table-responsive"><table class="table table-hover">';
                html += `
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Order Number</th>
                            <th>Total</th>
                            <th>Profit</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                `;
                
                orders.forEach(order => {
                    const time = new Date(order.timestamp).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    });
                    const profit = order.total - order.base_total;
                    const statusClass = order.status === 'paid' ? 'success' : 'warning';
                    const statusText = order.status === 'paid' ? 'Paid' : 'Unpaid';
                    
                    if (order.status === 'paid') {
                        paid++;
                    } else {
                        unpaid++;
                    }
                    
                    html += `
                        <tr>
                            <td>${time}</td>
                            <td><strong>${order.order_number}</strong></td>
                            <td>${formatCurrency(order.total)}</td>
                            <td>${formatCurrency(profit)}</td>
                            <td>
                                <span class="badge bg-${statusClass}">${statusText}</span>
                            </td>
                            <td>
                                <button class="btn btn-sm btn-info view-details" data-order-id="${order._id}">
                                    Details
                                </button>
                                <button class="btn btn-sm btn-${order.status === 'paid' ? 'warning' : 'success'} toggle-status" 
                                    data-order-id="${order._id}" 
                                    data-current-status="${order.status}">
                                    Mark as ${order.status === 'paid' ? 'Unpaid' : 'Paid'}
                                </button>
                            </td>
                        </tr>
                    `;
                });
                
                html += '</tbody></table></div>';
                container.innerHTML = html;
                
                unpaidCount.textContent = unpaid;
                paidCount.textContent = paid;
                
                // Add event listeners
                document.querySelectorAll('.view-details').forEach(button => {
                    button.addEventListener('click', function() {
                        const orderId = this.getAttribute('data-order-id');
                        loadOrderDetails(orderId);
                    });
                });
                
                document.querySelectorAll('.toggle-status').forEach(button => {
                    button.addEventListener('click', function() {
                        const orderId = this.getAttribute('data-order-id');
                        const currentStatus = this.getAttribute('data-current-status');
                        const newStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
                        
                        // Disable button during update
                        this.disabled = true;
                        this.textContent = 'Updating...';
                        
                        updateOrderStatus(orderId, newStatus);
                    });
                });
            })
            .catch(error => console.error('Error loading orders:', error));
    }
    
    // Load order details
    function loadOrderDetails(orderId) {
        fetch(`/api/orders/${orderId}`)
            .then(response => response.json())
            .then(order => {
                const modalBody = document.getElementById('modal-body-content');
                
                let html = `
                    <div class="mb-3">
                        <h6 class="text-muted">Order Number</h6>
                        <h5>${order.order_number}</h5>
                    </div>
                    <div class="mb-3">
                        <h6 class="text-muted">Date & Time</h6>
                        <p>${new Date(order.timestamp).toLocaleString()}</p>
                    </div>
                    <div class="mb-3">
                        <h6 class="text-muted">Status</h6>
                        <span class="badge bg-${order.status === 'paid' ? 'success' : 'warning'} fs-6">
                            ${order.status.toUpperCase()}
                        </span>
                    </div>
                    <hr>
                    <h6 class="mb-3">Order Items:</h6>
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th class="text-end">Price</th>
                                    <th class="text-end">Cost</th>
                                    <th class="text-end">Profit</th>
                                </tr>
                            </thead>
                            <tbody>
                `;
                
                order.items.forEach(item => {
                    const profit = item.price - item.base_price;
                    html += `
                        <tr>
                            <td>${item.product_name}</td>
                            <td class="text-end">${formatCurrency(item.price)}</td>
                            <td class="text-end">${formatCurrency(item.base_price)}</td>
                            <td class="text-end">${formatCurrency(profit)}</td>
                        </tr>
                    `;
                });
                
                const totalProfit = order.total - order.base_total;
                html += `
                            </tbody>
                            <tfoot>
                                <tr class="table-active">
                                    <th>Total</th>
                                    <th class="text-end">${formatCurrency(order.total)}</th>
                                    <th class="text-end">${formatCurrency(order.base_total)}</th>
                                    <th class="text-end">${formatCurrency(totalProfit)}</th>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                `;
                
                modalBody.innerHTML = html;
                orderDetailsModal.show();
            })
            .catch(error => console.error('Error loading order details:', error));
    }
    
    // Update order status
    function updateOrderStatus(orderId, newStatus) {
        fetch(`/api/orders/${orderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to update order status');
            }
            return response.json();
        })
        .then(data => {
            // Reload orders to reflect the change
            loadOrders(orderDateInput.value);
        })
        .catch(error => {
            console.error('Error updating order status:', error);
            alert('Error updating order status!');
            // Reload to reset button state
            loadOrders(orderDateInput.value);
        });
    }
    
    // Handle date change
    orderDateInput.addEventListener('change', (e) => {
        const date = new Date(e.target.value);
        selectedDateSpan.textContent = date.toLocaleDateString();
        loadOrders(e.target.value);
    });
    
    // Initial load
    loadOrders(orderDateInput.value);
});