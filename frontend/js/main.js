const originalFetch = window.fetch;
window.fetch = function(url, options = {}) {
  if (url.startsWith('/api/')) {
    options.headers = {
      ...options.headers,
      ...getAuthHeaders()
    };
    
    // Add offline detection
    if (!navigator.onLine) {
      console.log('Offline: Cannot make API request to', url);
      return Promise.reject(new Error('No internet connection'));
    }
  }
  
  return originalFetch(url, options)
    .catch(error => {
      console.error('Fetch error:', error);
      throw error;
    });
};

// Global variable for install prompt
let deferredPrompt;

let offlineManager;

// Flag to track if event listeners are already attached
let eventListenersAttached = false;

document.addEventListener('DOMContentLoaded', () => {
    offlineManager = window.offlineManager;
    
    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed: ', error);
            });
    }

    // Handle install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        // Show install button
        const installButton = document.getElementById('install-button');
        if (installButton) {
            installButton.style.display = 'block';
            
            // Remove any existing event listener first to avoid duplicates
            installButton.replaceWith(installButton.cloneNode(true));
            const newInstallButton = document.getElementById('install-button');
            
            newInstallButton.addEventListener('click', () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    deferredPrompt.userChoice.then(choiceResult => {
                        if (choiceResult.outcome === 'accepted') {
                            console.log('User accepted the install prompt');
                        } else {
                            console.log('User dismissed the install prompt');
                        }
                        deferredPrompt = null;
                        newInstallButton.style.display = 'none';
                    });
                }
            });
        }
    });

    let currentSale = [];
    let selectedTableId = null;
    let selectedOrderType = 'dine-in';
    let editingOrderId = null;
    let selectedCustomerId = null;
    let creditCustomers = [];
    let isProcessingOrder = false; // Flag to prevent multiple order submissions

    // Product categories for color coding
    const productCategories = {
        'coffee': ['express', 'capucin', 'direct', 'cappuccino', 'latte', 'espresso', 'macchiato'],
        'drinks': ['eau', 'water', 'boisson gazeux', 'coca', 'fanta', 'sprite', 'pepsi', 'juice', 'jus'],
        'other': [] // everything else
    };

    function checkOnlineStatus() {
        if (!navigator.onLine) {
            console.log('App is offline');
            showOfflineNotification();
            
            // Load offline table status
            loadOfflineTables();
            // Load offline orders
            loadOfflineOrdersList();
        } else {
            // Hide offline notification
            const offlineIndicator = document.getElementById('offline-indicator');
            if (offlineIndicator) {
                offlineIndicator.style.display = 'none';
            }
            
            // We're back online - sync offline orders
            syncOfflineOrders();
        }
    }

    function showOfflineNotification() {
        const offlineIndicator = document.getElementById('offline-indicator');
        if (offlineIndicator) {
            offlineIndicator.style.display = 'block';
        }
        
        // Remove when back online
        window.addEventListener('online', () => {
            if (offlineIndicator) {
                offlineIndicator.style.display = 'none';
            }
        });
    }
    
    // Get category colors
    function getCategoryColor(productName, category = null) {
        const name = productName.toLowerCase();
        
        // Check if category is provided
        if (category) {
            switch(category) {
                case 'coffee': return 'btn-warning';
                case 'drinks': return 'btn-info';
                default: return 'btn-success';
            }
        }
        
        // Fallback: check by name if no category
        if (productCategories.coffee.some(coffee => name.includes(coffee))) {
            return 'btn-warning';
        }
        if (productCategories.drinks.some(drink => name.includes(drink))) {
            return 'btn-info';
        }
        return 'btn-success';
    }
    
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

    // Show/hide delete button based on editing mode
    function updateDeleteButtonVisibility() {
        const deleteBtn = document.getElementById('delete-order');
        if (editingOrderId) {
            deleteBtn.style.display = 'block';
        } else {
            deleteBtn.style.display = 'none';
        }
    }

    // Credit functionality
    function showCreditSection() {
        const creditSection = document.getElementById('credit-section');
        if (selectedOrderType === 'credit') {
            creditSection.style.display = 'block';
            loadCreditCustomers();
        } else {
            creditSection.style.display = 'none';
            selectedCustomerId = null;
            // Clear credit form
            document.getElementById('customer-select').value = '';
            document.getElementById('new-customer-name').value = '';
            document.getElementById('customer-phone').value = '';
            document.getElementById('customer-address').value = '';
        }
    }

    // Load credit customers
    function loadCreditCustomers() {
        // Only load credit customers when online
        if (!navigator.onLine) {
            const customerSelect = document.getElementById('customer-select');
            customerSelect.innerHTML = '<option value="">Select existing customer</option>';
            return;
        }

        fetch('/api/credits/customers')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(customers => {
                creditCustomers = customers;
                const customerSelect = document.getElementById('customer-select');
                customerSelect.innerHTML = '<option value="">Select existing customer</option>';
                
                customers.forEach(customer => {
                    const creditInfo = customer.total_credit > 0 ? ` (Credit: ${formatCurrency(customer.total_credit)})` : '';
                    customerSelect.innerHTML += `<option value="${customer._id}">${customer.name}${creditInfo}</option>`;
                });
            })
            .catch(error => {
                console.error('Error loading customers:', error);
                // If customers endpoint doesn't exist yet, just continue
                const customerSelect = document.getElementById('customer-select');
                customerSelect.innerHTML = '<option value="">Select existing customer</option>';
            });
    }

    // Handle customer selection
    function handleCustomerSelection() {
        const customerSelect = document.getElementById('customer-select');
        if (customerSelect) {
            customerSelect.addEventListener('change', (e) => {
                selectedCustomerId = e.target.value;
                if (selectedCustomerId) {
                    // Clear new customer fields
                    document.getElementById('new-customer-name').value = '';
                    document.getElementById('customer-phone').value = '';
                    document.getElementById('customer-address').value = '';
                    
                    // Show selected customer info
                    const customer = creditCustomers.find(c => c._id === selectedCustomerId);
                    if (customer) {
                        const infoElement = document.getElementById('selected-table-info');
                        infoElement.textContent = `Credit Order - ${customer.name}`;
                    }
                }
            });
        }
    }

    // Handle new customer input
    function handleNewCustomerInput() {
        const newCustomerName = document.getElementById('new-customer-name');
        if (newCustomerName) {
            newCustomerName.addEventListener('input', (e) => {
                if (e.target.value.trim()) {
                    // Clear customer selection
                    document.getElementById('customer-select').value = '';
                    selectedCustomerId = null;
                    
                    // Update info display
                    const infoElement = document.getElementById('selected-table-info');
                    infoElement.textContent = `Credit Order - New Customer: ${e.target.value.trim()}`;
                }
            });
        }
    }

    // Complete credit order
    async function completeCreditOrder() {
        // Credit orders only work online
        if (!navigator.onLine) {
            alert('Credit orders require internet connection.');
            return;
        }

        let customerId = selectedCustomerId;
        let customerName = '';
        
        // If new customer, create customer first
        if (!customerId) {
            const newCustomerName = document.getElementById('new-customer-name').value.trim();
            if (!newCustomerName) {
                alert('Please select or enter a customer name for credit orders.');
                return;
            }
            
            const customerPhone = document.getElementById('customer-phone').value.trim();
            const customerAddress = document.getElementById('customer-address').value.trim();
            
            try {
                const response = await fetch('/api/credits/customers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: newCustomerName,
                        phone: customerPhone,
                        address: customerAddress
                    })
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    alert('Error creating customer: ' + (error.error || 'Unknown error'));
                    return;
                }
                
                const customer = await response.json();
                customerId = customer._id;
                customerName = customer.name;
            } catch (error) {
                console.error('Error creating customer:', error);
                alert('Error creating customer! Please try again.');
                return;
            }
        } else {
            const customer = creditCustomers.find(c => c._id === customerId);
            customerName = customer ? customer.name : '';
        }
        
        const completeBtn = document.getElementById('complete-order');
        completeBtn.disabled = true;
        completeBtn.textContent = 'Processing...';
        
        try {
            const response = await fetch('/api/credits/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: currentSale,
                    customer_id: customerId,
                    customer_name: customerName,
                    table_id: selectedTableId,
                    order_type: selectedTableId ? 'dine-in' : 'to-go'
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create credit order');
            }
            
            const order = await response.json();
            alert(`Credit order ${order.order_number} created successfully!\nTotal: ${formatCurrency(order.total)}\nCustomer: ${customerName}\nBalance: ${formatCurrency(order.remaining_balance)}`);
            
            // Reset form
            resetOrderForm();
            
        } catch (error) {
            console.error('Error creating credit order:', error);
            alert('Error creating credit order: ' + error.message);
        } finally {
            completeBtn.disabled = false;
            completeBtn.textContent = 'Complete Order';
        }
    }

    // Reset order form
    function resetOrderForm() {
        currentSale = [];
        selectedTableId = null;
        selectedOrderType = 'dine-in';
        selectedCustomerId = null;
        editingOrderId = null;
        document.getElementById('order-type').value = 'dine-in';
        document.getElementById('selected-table-info').textContent = 'No Table/Order Selected';
        document.querySelectorAll('.btn-table').forEach(btn => btn.classList.remove('table-selected'));
        
        // Reset credit form
        if (document.getElementById('customer-select')) {
            document.getElementById('customer-select').value = '';
            document.getElementById('new-customer-name').value = '';
            document.getElementById('customer-phone').value = '';
            document.getElementById('customer-address').value = '';
        }
        
        renderSale();
        updateSaleCount();
        updateDeleteButtonVisibility();
        showCreditSection();
        loadTables();
        loadTodaysOrders();
    }

    // Load tables
    async function loadTables() {
        if (!navigator.onLine) {
            await loadOfflineTables();
            return;
        }

        try {
            const response = await fetch('/api/orders/tables');
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const tables = await response.json();
            console.log('Tables received from API:', tables);
            const tableGrid = document.getElementById('table-grid');
            tableGrid.innerHTML = '';
            
            if (!Array.isArray(tables) || tables.length === 0) {
                tableGrid.innerHTML = '<p class="text-muted text-center">No tables found. Please check backend.</p>';
                console.warn('No tables data received or data is not an array:', tables);
                return;
            }
            
            tables.forEach(table => {
                const col = document.createElement('div');
                col.className = 'col-3 col-md-2 col-lg-3';
                col.innerHTML = `
                    <button class="btn btn-table w-100 ${table.status === 'occupied' ? 'table-occupied' : 'btn-outline-primary'}" 
                        data-id="${table._id}" 
                        data-number="${table.table_number}">
                        Table ${table.table_number}
                    </button>
                `;
                tableGrid.appendChild(col);
                console.log(`Added Table ${table.table_number} to grid.`);
            });

            // Add event listeners to table buttons
            document.querySelectorAll('.btn-table').forEach(button => {
                button.addEventListener('click', async () => {
                    const tableId = button.getAttribute('data-id');
                    const tableNumber = button.getAttribute('data-number');
                    selectTable(tableId, tableNumber);

                    // If table is occupied, load its order
                    if (button.classList.contains('table-occupied')) {
                        if (!navigator.onLine) {
                            // Load from offline storage when offline
                            try {
                                const tableOrders = await offlineManager.getOfflineOrdersForTable(tableId);
                                
                                if (tableOrders && tableOrders.length > 0) {
                                    // Use the most recent order
                                    const tableOrder = tableOrders[tableOrders.length - 1];
                                    currentSale = tableOrder.items;
                                    editingOrderId = tableOrder.id; // Use offline order ID
                                    selectedOrderType = tableOrder.order_type;
                                    selectedTableId = tableOrder.table_id;
                                    document.getElementById('order-type').value = tableOrder.order_type;
                                    renderSale();
                                    updateSaleCount();
                                    updateDeleteButtonVisibility();
                                    showCreditSection();
                                    document.getElementById('selected-table-info').textContent =
                                        `Table ${tableNumber} - Editing offline order`;
                                } else {
                                    // No offline order found
                                    currentSale = [];
                                    editingOrderId = null;
                                    renderSale();
                                    updateSaleCount();
                                    updateDeleteButtonVisibility();
                                    showCreditSection();
                                    document.getElementById('selected-table-info').textContent =
                                        `Table ${tableNumber} - No active order.`;
                                }
                            } catch (error) {
                                console.error('Error loading offline order:', error);
                                alert("Error loading table's order from offline storage!");
                            }
                        } else {
                            // Online - load from server
                            try {
                                const response = await fetch(`/api/orders/table/${tableId}`);
                                if (!response.ok) throw new Error('Failed to fetch order');
                                
                                const order = await response.json();
                                if (order && order.items && order.items.length > 0) {
                                    currentSale = order.items.map(item => ({
                                        id: item.product_id,
                                        name: item.product_name,
                                        price: item.price,
                                        base_price: item.base_price,
                                        quantity: item.quantity
                                    }));
                                    editingOrderId = order._id;
                                    selectedOrderType = order.order_type;
                                    selectedTableId = order.table_id;
                                    document.getElementById('order-type').value = order.order_type;
                                    renderSale();
                                    updateSaleCount();
                                    updateDeleteButtonVisibility();
                                    showCreditSection();
                                    document.getElementById('selected-table-info').textContent =
                                        `Table ${tableNumber} - Editing order #${order.order_number}`;
                                } else {
                                    // No open order, reset as new
                                    currentSale = [];
                                    editingOrderId = null;
                                    renderSale();
                                    updateSaleCount();
                                    updateDeleteButtonVisibility();
                                    showCreditSection();
                                    document.getElementById('selected-table-info').textContent =
                                        `Table ${tableNumber} - No active order.`;
                                }
                            } catch (error) {
                                console.error('Error loading order:', error);
                                alert("Error loading table's order!");
                            }
                        }
                    } else {
                        // Free table = start a new sale
                        currentSale = [];
                        editingOrderId = null;
                        renderSale();
                        updateSaleCount();
                        updateDeleteButtonVisibility();
                        showCreditSection();
                        document.getElementById('selected-table-info').textContent =
                            `Table ${tableNumber} Selected`;
                    }
                    
                    // Visual feedback!
                    document.querySelectorAll('.btn-table').forEach(btn => btn.classList.remove('table-selected'));
                    button.classList.add('table-selected');
                });
            });
            console.log(`Added event listeners to ${document.querySelectorAll('.btn-table').length} table buttons.`);
        } catch (error) {
            console.error('Error loading tables:', error);
            const tableGrid = document.getElementById('table-grid');
            tableGrid.innerHTML = '<p class="text-muted text-center">Error loading tables. Check console for details.</p>';
        }
    }
    
    // Select a table or reset for to-go/employee/credit
    function selectTable(tableId, tableNumber) {
        selectedTableId = (selectedOrderType === 'dine-in' || selectedOrderType === 'credit') ? tableId : null;
        const infoElement = document.getElementById('selected-table-info');
        
        if (selectedOrderType === 'dine-in') {
            infoElement.textContent = `Table ${tableNumber} Selected`;
        } else if (selectedOrderType === 'credit') {
            // For credit orders, check if customer is selected
            if (selectedCustomerId) {
                const customer = creditCustomers.find(c => c._id === selectedCustomerId);
                infoElement.textContent = `Credit Order - ${customer ? customer.name : 'Customer'} - Table ${tableNumber}`;
            } else {
                const newCustomerName = document.getElementById('new-customer-name').value.trim();
                if (newCustomerName) {
                    infoElement.textContent = `Credit Order - ${newCustomerName} - Table ${tableNumber}`;
                } else {
                    infoElement.textContent = `Credit Order - Table ${tableNumber}`;
                }
            }
        } else {
            infoElement.textContent = `${selectedOrderType.charAt(0).toUpperCase() + selectedOrderType.slice(1)} Order`;
        }
    }
    
    // Handle order type change
    document.getElementById('order-type').addEventListener('change', (e) => {
        selectedOrderType = e.target.value;
        selectedTableId = (selectedOrderType === 'dine-in' || selectedOrderType === 'credit') ? selectedTableId : null;
        
        const infoElement = document.getElementById('selected-table-info');
        if ((selectedOrderType === 'dine-in' || selectedOrderType === 'credit') && selectedTableId) {
            const selectedButton = document.querySelector(`.btn-table[data-id="${selectedTableId}"]`);
            const tableNumber = selectedButton ? selectedButton.getAttribute('data-number') : '';
            
            if (selectedOrderType === 'credit') {
                if (selectedCustomerId) {
                    const customer = creditCustomers.find(c => c._id === selectedCustomerId);
                    infoElement.textContent = `Credit Order - ${customer ? customer.name : 'Customer'} - Table ${tableNumber}`;
                } else {
                    const newCustomerName = document.getElementById('new-customer-name') ? document.getElementById('new-customer-name').value.trim() : '';
                    if (newCustomerName) {
                        infoElement.textContent = `Credit Order - ${newCustomerName} - Table ${tableNumber}`;
                    } else {
                        infoElement.textContent = `Credit Order - Table ${tableNumber}`;
                    }
                }
            } else {
                infoElement.textContent = selectedButton ? `Table ${tableNumber} Selected` : 'No Table Selected';
            }
        } else if (selectedOrderType === 'dine-in' || selectedOrderType === 'credit') {
            infoElement.textContent = selectedOrderType === 'credit' ? 'Credit Order - No Table Selected' : 'No Table Selected';
        } else {
            infoElement.textContent = `${selectedOrderType.charAt(0).toUpperCase() + selectedOrderType.slice(1)} Order`;
        }
        
        // Show/hide credit section
        showCreditSection();
        
        // Deselect table visually if not dine-in or credit
        if (selectedOrderType !== 'dine-in' && selectedOrderType !== 'credit') {
            document.querySelectorAll('.btn-table').forEach(btn => btn.classList.remove('table-selected'));
        }
    });
    
    // Load products with color coding
    function loadProducts() {
        fetch('/api/products')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(products => {
                console.log('Products received from API:', products.length);
                const productGrid = document.getElementById('product-grid');
                productGrid.innerHTML = '';
                
                // Sort products by category: coffee first, then drinks, then others
                const sortedProducts = products.sort((a, b) => {
                    const categoryOrder = { 'coffee': 0, 'drinks': 1, 'other': 2 };
                    const aCategory = a.category || getCategoryFromName(a.name);
                    const bCategory = b.category || getCategoryFromName(b.name);
                    return (categoryOrder[aCategory] || 2) - (categoryOrder[bCategory] || 2);
                });
                
                sortedProducts.forEach(product => {
                    const col = document.createElement('div');
                    col.className = 'col-6 col-md-4 col-lg-3';
                    const colorClass = getCategoryColor(product.name, product.category);
                    col.innerHTML = `
                        <button class="btn ${colorClass} btn-product w-100" 
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
                        // Check if table/order type is selected for dine-in
                        if (selectedOrderType === 'dine-in' && !selectedTableId) {
                            alert('Please select a table for dine-in orders.');
                            return;
                        }
                        
                        // Check if customer is selected for credit orders
                        if (selectedOrderType === 'credit') {
                            const newCustomerName = document.getElementById('new-customer-name').value.trim();
                            if (!selectedCustomerId && !newCustomerName) {
                                alert('Please select or enter a customer for credit orders.');
                                return;
                            }
                        }
                        
                        const product = {
                            id: button.getAttribute('data-id'),
                            name: button.getAttribute('data-name'),
                            price: parseFloat(button.getAttribute('data-price')),
                            base_price: parseFloat(button.getAttribute('data-base-price')),
                            quantity: 1
                        };
                        addToSale(product);
                    });
                });
            })
            .catch(error => console.error('Error loading products:', error));
    }

    // Helper function to get category from name (fallback)
    function getCategoryFromName(name) {
        const lowerName = name.toLowerCase();
        if (productCategories.coffee.some(coffee => lowerName.includes(coffee))) {
            return 'coffee';
        }
        if (productCategories.drinks.some(drink => lowerName.includes(drink))) {
            return 'drinks';
        }
        return 'other';
    }

    function addToSale(product) {
        const existingProduct = currentSale.find(item => item.id === product.id);
        if (existingProduct) {
            existingProduct.quantity += 1;
        } else {
            currentSale.push(product);
        }
        renderSale();
        updateSaleCount();
    }

    function renderSale() {
        const saleList = document.getElementById('current-sale');
        saleList.innerHTML = '';
        
        let total = 0;
        
        currentSale.forEach((item, index) => {
            const itemTotal = item.price * item.quantity;
            total += selectedOrderType === 'employee' ? 0 : itemTotal;
            
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            li.innerHTML = `
                <span>${item.name} (x${item.quantity})</span>
                <span>
                    <strong>${formatCurrency(itemTotal)}</strong>
                    <span class="btn btn-sm btn-outline-secondary mx-1 edit-qty" data-index="${index}" data-action="increase">+</span>
                    <span class="btn btn-sm btn-outline-secondary mx-1 edit-qty" data-index="${index}" data-action="decrease">-</span>
                    <span class="btn btn-sm btn-danger remove-item ms-1" data-index="${index}">✖</span>
                </span>
            `;
            saleList.appendChild(li);
        });
        
        // Update total (credit orders show full total)
        document.getElementById('total-amount').textContent = formatCurrency(total);
        
        // Add event listeners for remove and quantity edit
        document.querySelectorAll('.remove-item').forEach(span => {
            span.addEventListener('click', () => {
                const index = parseInt(span.getAttribute('data-index'));
                currentSale.splice(index, 1);
                renderSale();
                updateSaleCount();
            });
        });
        
        document.querySelectorAll('.edit-qty').forEach(span => {
            span.addEventListener('click', () => {
                const index = parseInt(span.getAttribute('data-index'));
                const action = span.getAttribute('data-action');
                if (action === 'increase') {
                    currentSale[index].quantity += 1;
                } else if (action === 'decrease' && currentSale[index].quantity > 1) {
                    currentSale[index].quantity -= 1;
                } else if (action === 'decrease') {
                    currentSale.splice(index, 1);
                }
                renderSale();
                updateSaleCount();
            });
        });
    }

    // Load today's orders
    function loadTodaysOrders() {
        if (!navigator.onLine) {
            // When offline, show offline orders instead
            loadOfflineOrdersList();
            return;
        }

        fetch('/api/orders/today')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(orders => {
                console.log('Today\'s orders received:', orders.length);
                const ordersList = document.getElementById('orders-list');
                const ordersCount = document.getElementById('orders-count');
                
                ordersList.innerHTML = '';
                ordersCount.textContent = orders.length;
                
                if (orders.length === 0) {
                    ordersList.innerHTML = '<p class="text-muted text-center p-2">No orders yet today</p>';
                    return;
                }
                
                // Display server orders
                orders.slice(0, 10).forEach(order => {
                    const orderElement = createOrderElement(order, false);
                    ordersList.appendChild(orderElement);
                });
                
                // Also load and display offline orders
                loadOfflineOrdersList();
            })
            .catch(error => {
                console.error('Error loading orders:', error);
                // If online but server error, show offline orders
                loadOfflineOrdersList();
            });
    }

    function createOrderElement(order, isOffline) {
        const orderTime = new Date(order.timestamp).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        let statusClass, statusText;
        if (isOffline) {
            statusClass = 'secondary';
            statusText = 'Not Synced';
        } else {
            statusClass = order.status === 'paid' ? 'success' : 'warning';
            statusText = order.status === 'paid' ? 'Paid' : 'Unpaid';
        }
        
        // Determine order type label
        let typeLabel;
        if (order.order_type === 'dine-in' && order.table_id) {
            typeLabel = `Table ${order.table_number || 'Unknown'}`;
        } else {
            typeLabel = order.order_type.charAt(0).toUpperCase() + order.order_type.slice(1);
        }
        
        // Calculate total if not provided
        let orderTotal = order.total || 0;
        if (!orderTotal && order.items) {
            orderTotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        }
        
        const orderDiv = document.createElement('div');
        orderDiv.className = `order-item mb-2 p-2 border rounded ${isOffline ? 'offline-order-ticket' : ''}`;
        
        orderDiv.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <small class="text-muted">${orderTime}</small><br>
                    <strong>${order.order_number || 'Offline Order'}</strong><br>
                    <small>${typeLabel}</small><br>
                    <span class="currency">${formatCurrency(orderTotal)}</span>
                </div>
                <div class="d-flex flex-column align-items-end">
                    <button class="btn btn-sm btn-${statusClass} order-status status-btn mb-1" 
                        data-order-id="${isOffline ? 'offline-' + order.id : order._id}" 
                        data-status="${isOffline ? 'offline' : order.status}"
                        data-is-offline="${isOffline}">
                        ${statusText}
                    </button>
                    ${isOffline ? '<span class="badge bg-warning text-dark">Offline</span>' : ''}
                </div>
            </div>
        `;
        
        // Add event listener to status button for online orders only
        if (!isOffline) {
            const statusBtn = orderDiv.querySelector('.status-btn');
            statusBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                const orderId = this.getAttribute('data-order-id');
                const currentStatus = this.getAttribute('data-status');
                const newStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
                updateOrderStatus(orderId, newStatus);
            });
        }
        
        return orderDiv;
    }

    async function loadOfflineOrdersList() {
        try {
            const offlineOrders = await offlineManager.getOfflineOrders();
            const ordersList = document.getElementById('orders-list');
            const ordersCount = document.getElementById('orders-count');
            
            if (offlineOrders.length > 0) {
                // Count both online and offline orders
                const currentCount = parseInt(ordersCount.textContent) || 0;
                ordersCount.textContent = currentCount + offlineOrders.length;
                
                // Display offline orders
                offlineOrders.forEach(order => {
                    const orderElement = createOrderElement(order, true);
                    ordersList.appendChild(orderElement);
                });
            }
        } catch (error) {
            console.error('Error loading offline orders:', error);
        }
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
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            loadTodaysOrders();
            loadTables();
        })
        .catch(error => {
            console.error('Error updating order status:', error);
            alert('Error updating order status!');
        });
    }

    // Clear sale button
    function clearSale() {
        if (currentSale.length > 0 && confirm('Are you sure you want to clear the current order?')) {
            resetOrderForm();
        }
    }

    // Complete order function
    async function completeOrder() {
        // Prevent multiple submissions
        if (isProcessingOrder) return;
        isProcessingOrder = true;
        
        if (currentSale.length === 0) {
            alert('No items in current order!');
            isProcessingOrder = false;
            return;
        }
        
        if (selectedOrderType === 'dine-in' && !selectedTableId) {
            alert('Please select a table for dine-in orders.');
            isProcessingOrder = false;
            return;
        }
        
        // Handle credit orders (they need special offline handling)
        if (selectedOrderType === 'credit') {
            isProcessingOrder = false;
            return completeCreditOrder();
        }
        
        const completeBtn = document.getElementById('complete-order');
        completeBtn.disabled = true;
        completeBtn.textContent = 'Processing...';
        
        // Calculate total
        const total = currentSale.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        const orderPayload = {
            items: currentSale,
            table_id: selectedTableId,
            order_type: selectedOrderType,
            timestamp: new Date().toISOString(),
            total: total,
            editingOrderId: editingOrderId,
            status: 'unpaid' // Default status for new orders
        };

        // Check if we're online
        if (navigator.onLine) {
            // Online - send to server directly
            try {
                let response;
                if (editingOrderId) {
                    response = await fetch(`/api/orders/${editingOrderId}/items`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ items: currentSale })
                    });
                } else {
                    response = await fetch('/api/orders', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(orderPayload)
                    });
                }
                
                if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
                
                const order = await response.json();
                const action = editingOrderId ? 'updated' : 'created';
                alert(`Order ${order.order_number || ''} ${action} successfully!\nTotal: ${formatCurrency(order.total || 0)}`);
                resetOrderForm();
            } catch (error) {
                console.error('Error saving order:', error);
                alert('Error saving order! Please try again.');
            } finally {
                completeBtn.disabled = false;
                completeBtn.textContent = 'Complete Order';
                isProcessingOrder = false;
            }
        } else {
            // Offline - save to local storage
            try {
                // Ensure offlineManager is initialized
                await offlineManager.ensureInitialized();
                
                // Save order to offline storage
                const orderId = await offlineManager.saveOfflineOrder(orderPayload);
                
                // Update table status locally if it's a dine-in order
                if (selectedOrderType === 'dine-in' && selectedTableId) {
                    await offlineManager.updateTableStatus(selectedTableId, 'occupied');
                    // Update UI to show table as occupied
                    document.querySelectorAll('.btn-table').forEach(btn => {
                        if (btn.getAttribute('data-id') === selectedTableId) {
                            btn.classList.add('table-occupied');
                        }
                    });
                }
                
                // Show offline order notification
                showOfflineOrderNotification();
                alert('Order saved offline! It will be synced when connection is restored.');
                resetOrderForm();
            } catch (error) {
                console.error('Error saving offline order:', error);
                alert('Error saving offline order!');
            } finally {
                completeBtn.disabled = false;
                completeBtn.textContent = 'Complete Order';
                isProcessingOrder = false;
            }
        }
    }
    
    function showOfflineOrderNotification() {
        // Create a temporary notification
        const notification = document.createElement('div');
        notification.className = 'alert alert-warning position-fixed';
        notification.style.cssText = 'top: 70px; right: 20px; z-index: 1050; min-width: 250px;';
        notification.innerHTML = `
            <div class="d-flex align-items-center">
                <span class="me-2">📝</span>
                <span>Order saved offline</span>
                <span class="badge bg-warning ms-2">Not Synced</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.add('fade');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 500);
        }, 3000);
    }

    async function syncOfflineOrders() {
        try {
            // Ensure offlineManager is initialized
            await offlineManager.ensureInitialized();
            
            const offlineOrders = await offlineManager.getOfflineOrders();
            
            for (const order of offlineOrders) {
                try {
                    // Check if this is an edit of an existing order
                    let response;
                    if (order.editingOrderId) {
                        // This was an edit of an existing order
                        response = await fetch(`/api/orders/${order.editingOrderId}/items`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ items: order.items })
                        });
                    } else {
                        // This is a new order
                        response = await fetch('/api/orders', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                items: order.items,
                                table_id: order.table_id,
                                order_type: order.order_type,
                                timestamp: order.timestamp,
                                total: order.total,
                                status: order.status || 'unpaid'
                            })
                        });
                    }
                    
                    if (response.ok) {
                        const savedOrder = await response.json();
                        console.log('Offline order synced successfully:', savedOrder);
                        
                        // Remove from offline storage after successful sync
                        await offlineManager.removeOfflineOrder(order.id);
                        
                        // Only update table status if order is paid
                        if (order.table_id && order.order_type === 'dine-in' && order.status === 'paid') {
                            await offlineManager.updateTableStatus(order.table_id, 'free');
                            // Update UI to show table as free
                            document.querySelectorAll('.btn-table').forEach(btn => {
                                if (btn.getAttribute('data-id') === order.table_id) {
                                    btn.classList.remove('table-occupied');
                                }
                            });
                        }
                        
                        // Refresh the orders list to remove the offline indicator
                        loadTodaysOrders();
                    }
                } catch (error) {
                    console.error('Error syncing offline order:', error);
                    // Don't remove from queue if sync failed
                }
            }
            
            // Reload tables and orders from server after sync
            loadTables();
            loadTodaysOrders();
        } catch (error) {
            console.error('Error getting offline orders:', error);
        }
    }

    async function loadOfflineTables() {
        try {
            // Ensure offlineManager is initialized
            await offlineManager.ensureInitialized();
            
            const tablesStatus = await offlineManager.getAllTablesStatus();
            
            tablesStatus.forEach(table => {
                document.querySelectorAll('.btn-table').forEach(btn => {
                    if (btn.getAttribute('data-id') === table.id) {
                        if (table.status === 'occupied') {
                            btn.classList.add('table-occupied');
                        } else {
                            btn.classList.remove('table-occupied');
                        }
                    }
                });
            });
        } catch (error) {
            console.error('Error loading offline tables:', error);
        }
    }

    // Delete order function
    function deleteOrder() {
        if (!editingOrderId) return;
        if (!confirm('Are you sure you want to delete this order? This action cannot be undone.')) return;

        fetch(`/api/orders/${editingOrderId}`, { method: 'DELETE' })
            .then(resp => {
                if (!resp.ok) throw new Error('Delete failed');
                return resp.json();
            })
            .then(() => {
                alert('Order deleted successfully!');
                resetOrderForm();
            })
            .catch(() => alert('Error deleting order!'));
    }

    // Event listeners - only attach once
    if (!eventListenersAttached) {
        document.getElementById('clear-sale').addEventListener('click', clearSale);
        document.getElementById('complete-order').addEventListener('click', completeOrder);
        document.getElementById('delete-order').addEventListener('click', deleteOrder);
        eventListenersAttached = true;
    }

    // Initialize credit form event listeners after DOM is ready
    setTimeout(() => {
        handleCustomerSelection();
        handleNewCustomerInput();
    }, 100);

    // Make functions globally accessible for debugging
    window.clearSale = clearSale;
    window.completeOrder = completeOrder;
    window.deleteOrder = deleteOrder;
    window.currentSale = currentSale;
    window.editingOrderId = editingOrderId;
    window.showCreditSection = showCreditSection;
    window.completeCreditOrder = completeCreditOrder;

    // offline 
    window.addEventListener('online', checkOnlineStatus);
    window.addEventListener('offline', checkOnlineStatus);
    checkOnlineStatus(); // Initial check

    // Initial load
    loadTables();
    loadProducts();
    loadTodaysOrders();
    renderSale();
    updateSaleCount();
    updateDeleteButtonVisibility();
    showCreditSection();
    
    // Refresh orders and tables every 30 seconds
    setInterval(() => {
        if (navigator.onLine) {
            loadTodaysOrders();
            loadTables();
        }
    }, 30000);
});