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
    const deleteOrderModal = new bootstrap.Modal(document.getElementById('deleteOrderModal'));
    
    let currentOrders = [];
    let orderToDelete = null;
    
    // Set today's date as default
    orderDateInput.value = new Date().toISOString().split('T')[0];
    selectedDateSpan.textContent = new Date().toLocaleDateString();
    
    // Currency formatter
    function formatCurrency(amount) {
        return `${amount.toFixed(2)} TND`;
    }

    // Get order type display text
    function getOrderTypeDisplay(orderType, tableId) {
        switch(orderType) {
            case 'dine-in': return tableId ? 'Dine-in' : 'Dine-in';
            case 'to-go': return 'To-Go';
            case 'employee': return 'Employee';
            default: return orderType;
        }
    }
    
    // Apply status filter
    function applyStatusFilter() {
        const filter = document.querySelector('input[name="statusFilter"]:checked').value;
        const filteredOrders = filter === 'all' ? currentOrders : currentOrders.filter(order => order.status === filter);
        renderOrders(filteredOrders);
    }

    // Render orders in both desktop and mobile views
    function renderOrders(orders) {
        const tableBody = document.getElementById('orders-table-body');
        const mobileContainer = document.getElementById('orders-mobile');
        const emptyState = document.getElementById('empty-state');
        
        tableBody.innerHTML = '';
        mobileContainer.innerHTML = '';
        
        if (orders.length === 0) {
            emptyState.classList.remove('d-none');
            return;
        }
        
        emptyState.classList.add('d-none');
        
        orders.forEach(order => {
            const time = new Date(order.timestamp).toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            const profit = order.total - order.base_total;
            const statusClass = order.status === 'paid' ? 'success' : 'warning';
            const statusText = order.status === 'paid' ? 'Paid' : 'Unpaid';
            const orderType = getOrderTypeDisplay(order.order_type, order.table_id);
            
            // Desktop table row
            const tr = document.createElement('tr');
            tr.className = order.status === 'paid' ? 'status-paid' : 'status-unpaid';
            tr.innerHTML = `
                <td>${time}</td>
                <td><strong>${order.order_number}</strong></td>
                <td>
                    <span class="badge bg-info">${orderType}</span>
                    ${order.order_type === 'employee' ? '<span class="badge bg-secondary ms-1">Free</span>' : ''}
                </td>
                <td>${formatCurrency(order.total)}</td>
                <td>${formatCurrency(profit)}</td>
                <td>
                    <span class="badge bg-${statusClass}">${statusText}</span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-info view-details" data-order-id="${order._id}">
                            Details
                        </button>
                        <button class="btn btn-${order.status === 'paid' ? 'warning' : 'success'} toggle-status" 
                            data-order-id="${order._id}" 
                            data-current-status="${order.status}">
                            ${order.status === 'paid' ? 'Unpaid' : 'Paid'}
                        </button>
                        <button class="btn btn-danger delete-order" data-order-id="${order._id}">
                            Delete
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);

            // Mobile card
            const mobileCard = document.createElement('div');
            mobileCard.className = `order-card ${order.status === 'paid' ? 'status-paid' : 'status-unpaid'}`;
            mobileCard.innerHTML = `
                <div class="order-header">
                    <strong>${order.order_number}</strong>
                    <span class="badge bg-${statusClass}">${statusText}</span>
                </div>
                <div class="order-details">
                    <div><strong>Time:</strong> ${time}</div>
                    <div><strong>Type:</strong> ${orderType}</div>
                    <div><strong>Total:</strong> ${formatCurrency(order.total)}</div>
                    <div><strong>Profit:</strong> ${formatCurrency(profit)}</div>
                </div>
                <div class="order-actions">
                    <button class="btn btn-info view-details" data-order-id="${order._id}">
                        Details
                    </button>
                    <button class="btn btn-${order.status === 'paid' ? 'warning' : 'success'} toggle-status" 
                        data-order-id="${order._id}" 
                        data-current-status="${order.status}">
                        ${order.status === 'paid' ? 'Unpaid' : 'Paid'}
                    </button>
                    <button class="btn btn-danger delete-order" data-order-id="${order._id}">
                        Delete
                    </button>
                </div>
            `;
            mobileContainer.appendChild(mobileCard);
        });
        
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

        document.querySelectorAll('.delete-order').forEach(button => {
            button.addEventListener('click', function() {
                const orderId = this.getAttribute('data-order-id');
                showDeleteConfirmation(orderId);
            });
        });
    }
    
    // Load orders for selected date
    function loadOrders(date) {
        fetch(`/api/orders/date/${date}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(orders => {
                currentOrders = orders;
                updateSummary(orders);
                applyStatusFilter();
            })
            .catch(error => {
                console.error('Error loading orders:', error);
                document.getElementById('empty-state').classList.remove('d-none');
            });
    }

    // Update summary cards
    function updateSummary(orders) {
        let unpaid = 0;
        let paid = 0;
        let totalRevenue = 0;

        orders.forEach(order => {
            if (order.status === 'paid') {
                paid++;
            } else {
                unpaid++;
            }
            totalRevenue += order.order_type === 'employee' ? 0 : order.total;
        });

        document.getElementById('total-orders').textContent = orders.length;
        document.getElementById('unpaid-count').textContent = unpaid;
        document.getElementById('paid-count').textContent = paid;
        document.getElementById('total-revenue').textContent = formatCurrency(totalRevenue);
    }
    
    // Load order details
    function loadOrderDetails(orderId) {
        fetch(`/api/orders/${orderId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(order => {
                const modalBody = document.getElementById('modal-body-content');
                const orderType = getOrderTypeDisplay(order.order_type, order.table_id);
                
                let html = `
                    <div class="row mb-3">
                        <div class="col-md-6">
                            <h6 class="text-muted">Order Number</h6>
                            <h5>${order.order_number}</h5>
                        </div>
                        <div class="col-md-6">
                            <h6 class="text-muted">Date & Time</h6>
                            <p>${new Date(order.timestamp).toLocaleString()}</p>
                        </div>
                    </div>
                    <div class="row mb-3">
                        <div class="col-md-6">
                            <h6 class="text-muted">Order Type</h6>
                            <span class="badge bg-info fs-6">${orderType}</span>
                            ${order.order_type === 'employee' ? '<span class="badge bg-secondary ms-1">Free</span>' : ''}
                        </div>
                        <div class="col-md-6">
                            <h6 class="text-muted">Status</h6>
                            <span class="badge bg-${order.status === 'paid' ? 'success' : 'warning'} fs-6">
                                ${order.status.toUpperCase()}
                            </span>
                        </div>
                    </div>
                    <hr>
                    <h6 class="mb-3">Order Items:</h6>
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th class="text-end">Qty</th>
                                    <th class="text-end">Price</th>
                                    <th class="text-end">Cost</th>
                                    <th class="text-end">Profit</th>
                                </tr>
                            </thead>
                            <tbody>
                `;
                
                order.items.forEach(item => {
                    const profit = (item.price - item.base_price) * item.quantity;
                    const itemTotal = item.price * item.quantity;
                    const itemCost = item.base_price * item.quantity;
                    html += `
                        <tr>
                            <td>${item.product_name}</td>
                            <td class="text-end">${item.quantity}</td>
                            <td class="text-end">${formatCurrency(itemTotal)}</td>
                            <td class="text-end">${formatCurrency(itemCost)}</td>
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
                                    <th class="text-end">${order.items.reduce((sum, item) => sum + item.quantity, 0)}</th>
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
            .catch(error => {
                console.error('Error loading order details:', error);
                alert('Error loading order details!');
            });
    }

    // Show delete confirmation
    function showDeleteConfirmation(orderId) {
        const order = currentOrders.find(o => o._id === orderId);
        if (!order) return;

        orderToDelete = orderId;
        const detailsDiv = document.getElementById('delete-order-details');
        const orderType = getOrderTypeDisplay(order.order_type, order.table_id);
        
        detailsDiv.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <h6>${order.order_number}</h6>
                    <p class="mb-1"><strong>Type:</strong> ${orderType}</p>
                    <p class="mb-1"><strong>Total:</strong> ${formatCurrency(order.total)}</p>
                    <p class="mb-1"><strong>Status:</strong> ${order.status}</p>
                    <p class="mb-0"><strong>Items:</strong> ${order.items.length} items</p>
                </div>
            </div>
        `;
        
        deleteOrderModal.show();
    }

    // Delete order
    function deleteOrder(orderId) {
        fetch(`/api/orders/${orderId}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            alert('Order deleted successfully!');
            deleteOrderModal.hide();
            loadOrders(orderDateInput.value); // Reload orders
        })
        .catch(error => {
            console.error('Error deleting order:', error);
            alert('Error deleting order! ' + error.message);
        });
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

    // Export orders to CSV
    window.exportOrders = function() {
        const date = orderDateInput.value;
        const startDate = date;
        const endDate = date;
        
        fetch('/api/orders/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startDate, endDate })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Export failed');
            }
            return response.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `orders_${date}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        })
        .catch(error => {
            console.error('Error exporting orders:', error);
            alert('Error exporting orders!');
        });
    };
    
    // Event listeners
    orderDateInput.addEventListener('change', (e) => {
        const date = new Date(e.target.value);
        selectedDateSpan.textContent = date.toLocaleDateString();
        loadOrders(e.target.value);
    });

    // Status filter event listeners
    document.querySelectorAll('input[name="statusFilter"]').forEach(radio => {
        radio.addEventListener('change', applyStatusFilter);
    });

    // Delete confirmation
    document.getElementById('confirm-delete-btn').addEventListener('click', () => {
        if (orderToDelete) {
            deleteOrder(orderToDelete);
            orderToDelete = null;
        }
    });
    
    // Initial load
    loadOrders(orderDateInput.value);
});