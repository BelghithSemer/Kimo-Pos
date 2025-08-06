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
    const paymentModal = new bootstrap.Modal(document.getElementById('paymentModal'));
    let currentOrders = [];
    
    // Currency formatter
    function formatCurrency(amount) {
        return `${amount.toFixed(2)} TND`;
    }

    // Get status badge class
    function getStatusBadge(status) {
        const badges = {
            'pending': 'bg-warning text-dark',
            'partial': 'bg-info',
            'paid': 'bg-success'
        };
        return badges[status] || 'bg-secondary';
    }

    // Load customers
    function loadCustomers() {
        fetch('/api/credits/customers')
            .then(response => response.json())
            .then(customers => {
                const customersTable = document.getElementById('customers-table');
                const customersMobile = document.getElementById('customers-mobile');
                
                customersTable.innerHTML = '';
                customersMobile.innerHTML = '';
                
                customers.forEach(customer => {
                    const lastTransaction = new Date(customer.last_transaction).toLocaleDateString();
                    
                    // Desktop table row
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>${customer.name}</strong></td>
                        <td>${customer.phone || 'N/A'}</td>
                        <td><strong>${formatCurrency(customer.total_credit)}</strong></td>
                        <td>${lastTransaction}</td>
                        <td>
                            <button class="btn btn-sm btn-info" onclick="viewCustomerDetails('${customer._id}')">
                                View Details
                            </button>
                        </td>
                    `;
                    customersTable.appendChild(tr);

                    // Mobile card
                    const mobileCard = document.createElement('div');
                    mobileCard.className = 'customer-card';
                    mobileCard.innerHTML = `
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <strong>${customer.name}</strong>
                            <span class="badge bg-primary">${formatCurrency(customer.total_credit)}</span>
                        </div>
                        <div class="mb-2">
                            <small><strong>Phone:</strong> ${customer.phone || 'N/A'}</small><br>
                            <small><strong>Last Transaction:</strong> ${lastTransaction}</small>
                        </div>
                        <button class="btn btn-sm btn-info" onclick="viewCustomerDetails('${customer._id}')">
                            View Details
                        </button>
                    `;
                    customersMobile.appendChild(mobileCard);
                });
            })
            .catch(error => console.error('Error loading customers:', error));
    }

    // Load credit orders
    function loadCreditOrders(statusFilter = 'all') {
        let url = '/api/credits/orders';
        if (statusFilter !== 'all') {
            url += `?status=${statusFilter}`;
        }
        
        fetch(url)
            .then(response => response.json())
            .then(orders => {
                currentOrders = orders;
                renderOrders(orders);
            })
            .catch(error => console.error('Error loading credit orders:', error));
    }

    // Render orders
    function renderOrders(orders) {
        const ordersTable = document.getElementById('orders-table');
        const ordersMobile = document.getElementById('orders-mobile');
        
        ordersTable.innerHTML = '';
        ordersMobile.innerHTML = '';
        
        orders.forEach(order => {
            const date = new Date(order.timestamp).toLocaleDateString();
            const statusBadge = getStatusBadge(order.status);
            const statusText = order.status.charAt(0).toUpperCase() + order.status.slice(1);
            
            // Desktop table row
            const tr = document.createElement('tr');
            tr.className = `status-${order.status}`;
            tr.innerHTML = `
                <td><strong>${order.order_number}</strong></td>
                <td>${order.customer_name}</td>
                <td>${formatCurrency(order.total)}</td>
                <td>${formatCurrency(order.amount_paid)}</td>
                <td><strong>${formatCurrency(order.remaining_balance)}</strong></td>
                <td><span class="badge ${statusBadge}">${statusText}</span></td>
                <td>${date}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-info" onclick="viewOrderDetails('${order._id}')">
                            Details
                        </button>
                        ${order.remaining_balance > 0 ? `
                            <button class="btn btn-success" onclick="addPayment('${order._id}', ${order.remaining_balance})">
                                Pay
                            </button>
                        ` : ''}
                    </div>
                </td>
            `;
            ordersTable.appendChild(tr);

            // Mobile card
            const mobileCard = document.createElement('div');
            mobileCard.className = `order-card status-${order.status}`;
            mobileCard.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <strong>${order.order_number}</strong>
                    <span class="badge ${statusBadge}">${statusText}</span>
                </div>
                <div class="mb-2">
                    <div><strong>Customer:</strong> ${order.customer_name}</div>
                    <div><strong>Total:</strong> ${formatCurrency(order.total)}</div>
                    <div><strong>Paid:</strong> ${formatCurrency(order.amount_paid)}</div>
                    <div><strong>Balance:</strong> ${formatCurrency(order.remaining_balance)}</div>
                    <div><strong>Date:</strong> ${date}</div>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-info" onclick="viewOrderDetails('${order._id}')">
                        Details
                    </button>
                    ${order.remaining_balance > 0 ? `
                        <button class="btn btn-sm btn-success" onclick="addPayment('${order._id}', ${order.remaining_balance})">
                            Pay
                        </button>
                    ` : ''}
                </div>
            `;
            ordersMobile.appendChild(mobileCard);
        });
    }

    // View customer details
    window.viewCustomerDetails = function(customerId) {
        fetch(`/api/credits/customers/${customerId}/summary`)
            .then(response => response.json())
            .then(data => {
                alert(`Customer: ${data.customer.name}\nTotal Credit: ${formatCurrency(data.customer.total_credit)}\nTotal Orders: ${data.totalOrders}\nPending: ${data.pendingOrders}, Partial: ${data.partialOrders}, Paid: ${data.paidOrders}`);
            })
            .catch(error => {
                console.error('Error loading customer details:', error);
                alert('Error loading customer details!');
            });
    };

    // View order details
    window.viewOrderDetails = function(orderId) {
        fetch(`/api/credits/orders/${orderId}`)
            .then(response => response.json())
            .then(data => {
                const { order, payments } = data;
                let details = `Order: ${order.order_number}\n`;
                details += `Customer: ${order.customer_name}\n`;
                details += `Total: ${formatCurrency(order.total)}\n`;
                details += `Paid: ${formatCurrency(order.amount_paid)}\n`;
                details += `Balance: ${formatCurrency(order.remaining_balance)}\n\n`;
                details += `Items:\n`;
                order.items.forEach(item => {
                    details += `- ${item.product_name} (x${item.quantity}): ${formatCurrency(item.price * item.quantity)}\n`;
                });
                
                if (payments.length > 0) {
                    details += `\nPayment History:\n`;
                    payments.forEach(payment => {
                        details += `- ${formatCurrency(payment.amount)} (${payment.payment_method}) - ${new Date(payment.timestamp).toLocaleDateString()}\n`;
                    });
                }
                
                alert(details);
            })
            .catch(error => {
                console.error('Error loading order details:', error);
                alert('Error loading order details!');
            });
    };

    // Add payment
    window.addPayment = function(orderId, remainingBalance) {
        document.getElementById('payment-order-id').value = orderId;
        document.getElementById('remaining-balance').textContent = formatCurrency(remainingBalance);
        document.getElementById('payment-amount').max = remainingBalance;
        document.getElementById('payment-amount').value = remainingBalance;
        paymentModal.show();
    };

    // Submit payment
    window.submitPayment = function() {
        const orderId = document.getElementById('payment-order-id').value;
        const amount = parseFloat(document.getElementById('payment-amount').value);
        const paymentMethod = document.getElementById('payment-method').value;
        const notes = document.getElementById('payment-notes').value;

        if (!amount || amount <= 0) {
            alert('Please enter a valid payment amount!');
            return;
        }

        fetch(`/api/credits/orders/${orderId}/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount,
                payment_method: paymentMethod,
                notes
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Payment failed');
            }
            return response.json();
        })
        .then(data => {
            alert('Payment added successfully!');
            paymentModal.hide();
            document.getElementById('payment-form').reset();
            loadCreditOrders();
            loadCustomers();
        })
        .catch(error => {
            console.error('Error adding payment:', error);
            alert('Error adding payment!');
        });
    };

    // Status filter event listeners
    document.querySelectorAll('input[name="statusFilter"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            loadCreditOrders(e.target.value);
        });
    });

    // Initial load
    loadCustomers();
    loadCreditOrders();
});