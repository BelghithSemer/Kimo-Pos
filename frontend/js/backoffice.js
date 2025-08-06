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
    // Set today's date as default
    const salesDateInput = document.getElementById('sales-date');
    salesDateInput.value = new Date().toISOString().split('T')[0];
    
    // Stock configuration modal
    const stockConfigModal = new bootstrap.Modal(document.getElementById('stockConfigModal'));
    
    // Currency formatter
    function formatCurrency(amount) {
        return `${amount.toFixed(2)} TND`;
    }

    // Get category display info
    function getCategoryInfo(category) {
        switch(category) {
            case 'coffee':
                return { badge: 'category-coffee', text: 'Coffee' };
            case 'drinks':
                return { badge: 'category-drinks', text: 'Drinks' };
            default:
                return { badge: 'category-other', text: 'Other' };
        }
    }

    // Save product function - FIXED!
    function saveProduct(id, isMobile) {
        const prefix = isMobile ? 'mobile-' : '';
        const name = document.getElementById(`${prefix}name-${id}`).value;
        const category = document.getElementById(`${prefix}category-${id}`).value;
        const price = parseFloat(document.getElementById(`${prefix}price-${id}`).value);
        const basePrice = parseFloat(document.getElementById(`${prefix}base-price-${id}`).value);

        if (!name || isNaN(price) || isNaN(basePrice)) {
            alert('Please enter valid values!');
            return;
        }

        console.log('Saving product:', { id, name, category, price, basePrice }); // Debug log

        fetch(`/api/products/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name, 
                category, 
                price, 
                base_price: basePrice 
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Product updated:', data); // Debug log
            alert('Product updated successfully!');
            loadProducts(); // Reload to update profit display
        })
        .catch(error => {
            console.error('Error updating product:', error);
            alert('Error updating product! ' + error.message);
        });
    }

    // Delete product function
    function deleteProduct(id) {
        if (confirm('Are you sure you want to delete this product?')) {
            fetch(`/api/products/${id}`, {
                method: 'DELETE'
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                alert('Product deleted successfully!');
                loadProducts();
            })
            .catch(error => {
                console.error('Error deleting product:', error);
                alert('Error deleting product! ' + error.message);
            });
        }
    }
    
    // Load products
    function loadProducts() {
        fetch('/api/products')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(products => {
                console.log('Loaded products:', products); // Debug log
                const productsTable = document.getElementById('products-table');
                const productsMobile = document.getElementById('products-mobile');
                productsTable.innerHTML = '';
                productsMobile.innerHTML = '';
                
                products.forEach(product => {
                    const profit = product.price - (product.base_price || 0);
                    const profitMargin = product.price > 0 ? ((profit / product.price) * 100).toFixed(1) : 0;
                    const categoryInfo = getCategoryInfo(product.category);
                    
                    // Desktop table row
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>
                            <input type="text" class="form-control" value="${product.name}" id="name-${product._id}">
                        </td>
                        <td>
                            <select class="form-control" id="category-${product._id}">
                                <option value="coffee" ${product.category === 'coffee' ? 'selected' : ''}>Coffee</option>
                                <option value="drinks" ${product.category === 'drinks' ? 'selected' : ''}>Drinks</option>
                                <option value="other" ${(product.category === 'other' || !product.category) ? 'selected' : ''}>Other</option>
                            </select>
                        </td>
                        <td>
                            <input type="number" step="0.01" class="form-control" value="${product.price}" id="price-${product._id}">
                        </td>
                        <td>
                            <input type="number" step="0.01" class="form-control" value="${product.base_price || 0}" id="base-price-${product._id}">
                        </td>
                        <td>
                            ${formatCurrency(profit)} (${profitMargin}%)
                        </td>
                        <td>
                            <div class="btn-group-vertical btn-group-sm">
                                <button class="btn btn-success save-btn" data-id="${product._id}">Save</button>
                                <button class="btn btn-info" onclick="configureStock('${product._id}')">Stock</button>
                                <button class="btn btn-danger delete-btn" data-id="${product._id}">Delete</button>
                            </div>
                        </td>
                    `;
                    productsTable.appendChild(tr);

                    // Mobile card
                    const mobileCard = document.createElement('div');
                    mobileCard.className = 'product-card';
                    mobileCard.innerHTML = `
                        <div class="product-name">
                            <input type="text" class="form-control" value="${product.name}" id="mobile-name-${product._id}">
                        </div>
                        <div class="product-details">
                            <div>
                                <label class="form-label">Category</label>
                                <select class="form-control" id="mobile-category-${product._id}">
                                    <option value="coffee" ${product.category === 'coffee' ? 'selected' : ''}>Coffee</option>
                                    <option value="drinks" ${product.category === 'drinks' ? 'selected' : ''}>Drinks</option>
                                    <option value="other" ${(product.category === 'other' || !product.category) ? 'selected' : ''}>Other</option>
                                </select>
                            </div>
                            <div>
                                <label class="form-label">Sale Price</label>
                                <input type="number" step="0.01" class="form-control" value="${product.price}" id="mobile-price-${product._id}">
                            </div>
                            <div>
                                <label class="form-label">Base Price</label>
                                <input type="number" step="0.01" class="form-control" value="${product.base_price || 0}" id="mobile-base-price-${product._id}">
                            </div>
                            <div>
                                <label class="form-label">Profit</label>
                                <div class="form-control-plaintext">${formatCurrency(profit)} (${profitMargin}%)</div>
                            </div>
                        </div>
                        <div class="product-actions">
                            <button class="btn btn-success mobile-save-btn" data-id="${product._id}">Save</button>
                            <button class="btn btn-info" onclick="configureStock('${product._id}')">Stock</button>
                            <button class="btn btn-danger mobile-delete-btn" data-id="${product._id}">Delete</button>
                        </div>
                    `;
                    productsMobile.appendChild(mobileCard);
                });

                // Add event listeners for save buttons (desktop) - FIXED EVENT BINDING!
                document.querySelectorAll('.save-btn').forEach(button => {
                    button.addEventListener('click', function() {
                        const id = this.getAttribute('data-id');
                        console.log('Desktop save clicked for product:', id); // Debug log
                        saveProduct(id, false);
                    });
                });

                // Add event listeners for save buttons (mobile) - FIXED EVENT BINDING!
                document.querySelectorAll('.mobile-save-btn').forEach(button => {
                    button.addEventListener('click', function() {
                        const id = this.getAttribute('data-id');
                        console.log('Mobile save clicked for product:', id); // Debug log
                        saveProduct(id, true);
                    });
                });

                // Add event listeners for delete buttons (desktop)
                document.querySelectorAll('.delete-btn').forEach(button => {
                    button.addEventListener('click', function() {
                        const id = this.getAttribute('data-id');
                        deleteProduct(id);
                    });
                });

                // Add event listeners for delete buttons (mobile)
                document.querySelectorAll('.mobile-delete-btn').forEach(button => {
                    button.addEventListener('click', function() {
                        const id = this.getAttribute('data-id');
                        deleteProduct(id);
                    });
                });
            })
            .catch(error => {
                console.error('Error loading products:', error);
                alert('Error loading products: ' + error.message);
            });
    }

    // Handle add product form submission
    document.getElementById('add-product-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const name = document.getElementById('product-name').value;
        const category = document.getElementById('product-category').value;
        const price = parseFloat(document.getElementById('product-price').value);
        const basePrice = parseFloat(document.getElementById('product-base-price').value);

        if (!name || isNaN(price) || isNaN(basePrice)) {
            alert('Please enter valid values!');
            return;
        }

        fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, category, price, base_price: basePrice })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            alert('Product added successfully!');
            document.getElementById('add-product-form').reset();
            loadProducts(); // Reload the table
        })
        .catch(error => {
            console.error('Error adding product:', error);
            alert('Error adding product! ' + error.message);
        });
    });

    // Load sales summary with expenses - UPDATED DISPLAY
    // Load sales summary with expenses and credit payments - UPDATED DISPLAY
function loadSalesSummary(date) {
    fetch(`/api/orders/summary/${date}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            const summaryDiv = document.getElementById('sales-summary');
            
            if (!data.totals || data.totals.total_orders === 0 && data.totals.credit_payments === 0) {
                summaryDiv.innerHTML = '<p class="text-center text-muted">No sales data for this date</p>';
                return;
            }
            
            let html = `
                <div class="row mb-4 summary-cards">
                    <div class="col-lg-2 col-md-3 col-6">
                        <div class="card text-center">
                            <div class="card-body">
                                <h6 class="card-title">Total Orders</h6>
                                <h4 class="text-primary">${data.totals.total_orders}</h4>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-2 col-md-3 col-6">
                        <div class="card text-center">
                            <div class="card-body">
                                <h6 class="card-title">Orders Revenue</h6>
                                <h4 class="text-success">${formatCurrency(data.totals.order_revenue || 0)}</h4>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-2 col-md-3 col-6">
                        <div class="card text-center">
                            <div class="card-body">
                                <h6 class="card-title">Credit Payments</h6>
                                <h4 class="text-info">${formatCurrency(data.totals.credit_payments || 0)}</h4>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-2 col-md-3 col-6">
                        <div class="card text-center">
                            <div class="card-body">
                                <h6 class="card-title">Total Revenue</h6>
                                <h4 class="text-success">${formatCurrency(data.totals.total_revenue)}</h4>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-2 col-md-3 col-6">
                        <div class="card text-center">
                            <div class="card-body">
                                <h6 class="card-title">Expenses</h6>
                                <h4 class="text-danger">${formatCurrency(data.totals.total_expenses || 0)}</h4>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-2 col-md-3 col-6">
                        <div class="card text-center">
                            <div class="card-body">
                                <h6 class="card-title">Current Cash</h6>
                                <small class="text-muted">(Revenue - Expenses)</small>
                                <h4 class="text-primary">${formatCurrency(data.totals.current_cash || 0)}</h4>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="row mb-4">
                    <div class="col-lg-4 col-md-6 mb-3">
                        <h5>Product Sales Breakdown</h5>
                        <div class="table-responsive">
                            <table class="table table-striped table-sm">
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th>Qty</th>
                                        <th>Revenue</th>
                                        <th>Profit</th>
                                    </tr>
                                </thead>
                                <tbody>
            `;
            
            data.products.forEach(product => {
                html += `
                    <tr>
                        <td>${product.product_name}</td>
                        <td>${product.quantity_sold}</td>
                        <td>${formatCurrency(product.total_revenue)}</td>
                        <td>${formatCurrency(product.profit)}</td>
                    </tr>
                `;
            });
            
            html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="col-lg-4 col-md-6 mb-3">
                        <h5>Daily Expenses</h5>
            `;

            if (data.expenses && data.expenses.length > 0) {
                html += `
                        <div class="table-responsive">
                            <table class="table table-striped table-sm">
                                <thead>
                                    <tr>
                                        <th>Description</th>
                                        <th>Category</th>
                                        <th>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                `;
                data.expenses.forEach(expense => {
                    html += `
                        <tr>
                            <td>${expense.description}</td>
                            <td><span class="badge bg-secondary">${expense.category}</span></td>
                            <td>${formatCurrency(expense.amount)}</td>
                        </tr>
                    `;
                });
                html += `
                                </tbody>
                            </table>
                        </div>
                `;
            } else {
                html += '<p class="text-muted">No expenses recorded for this date</p>';
            }

            html += `
                    </div>
                    <div class="col-lg-4 col-md-12 mb-3">
                        <h5>Credit Payments Received</h5>
            `;

            if (data.credit_payments && data.credit_payments.length > 0) {
                html += `
                        <div class="table-responsive">
                            <table class="table table-striped table-sm">
                                <thead>
                                    <tr>
                                        <th>Amount</th>
                                        <th>Method</th>
                                        <th>Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                `;
                data.credit_payments.forEach(payment => {
                    const time = new Date(payment.timestamp).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    });
                    html += `
                        <tr>
                            <td><strong>${formatCurrency(payment.amount)}</strong></td>
                            <td><span class="badge bg-info">${payment.payment_method}</span></td>
                            <td>${time}</td>
                        </tr>
                    `;
                });
                html += `
                                </tbody>
                                <tfoot>
                                    <tr class="table-active">
                                        <th>Total: ${formatCurrency(data.totals.credit_payments || 0)}</th>
                                        <th colspan="2"></th>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                `;
            } else {
                html += '<p class="text-muted">No credit payments received for this date</p>';
            }

            html += `
                    </div>
                </div>
            `;
            
            summaryDiv.innerHTML = html;
        })
        .catch(error => {
            console.error('Error loading sales summary:', error);
            document.getElementById('sales-summary').innerHTML = 
                '<p class="text-center text-danger">Error loading sales data: ' + error.message + '</p>';
        });
}

    // Handle date change for sales summary
    salesDateInput.addEventListener('change', (e) => {
        loadSalesSummary(e.target.value);
    });

    // Show stock configuration modal
    window.configureStock = function(productId) {
        document.getElementById('config-product-id').value = productId;
        
        // Load available stock items
        fetch('/api/stock')
            .then(response => response.json())
            .then(stockItems => {
                const stockList = document.getElementById('stock-items-list');
                stockList.innerHTML = '';
                
                // Get current product configuration
                fetch(`/api/products/${productId}`)
                    .then(response => response.json())
                    .then(product => {
                        stockItems.forEach(stock => {
                            const existingConfig = product.stock_items ? 
                                product.stock_items.find(si => si.stock_id._id === stock._id || si.stock_id === stock._id) : null;
                            
                            const div = document.createElement('div');
                            div.className = 'mb-3 border p-2 rounded';
                            div.innerHTML = `
                                <div class="form-check">
                                    <input class="form-check-input stock-check" type="checkbox" 
                                        id="stock-${stock._id}" 
                                        data-stock-id="${stock._id}"
                                        ${existingConfig ? 'checked' : ''}>
                                    <label class="form-check-label" for="stock-${stock._id}">
                                        <strong>${stock.name}</strong> (${stock.unit})
                                    </label>
                                </div>
                                <div class="mt-2" style="${existingConfig ? '' : 'display: none;'}" id="config-${stock._id}">
                                    <label class="form-label">Quantity per product (${stock.unit})</label>
                                    <input type="number" step="0.001" class="form-control" 
                                        id="quantity-${stock._id}" 
                                        value="${existingConfig ? existingConfig.quantity_per_unit : ''}"
                                        placeholder="e.g., 0.011 for coffee">
                                    <small class="text-muted">
                                        ${stock.name === 'Coffee Beans' ? 'Example: 0.011 kg per cup (1kg = ~90 cups)' : ''}
                                        ${stock.name === 'Milk' ? 'Example: 0.15 L per cappuccino' : ''}
                                    </small>
                                </div>
                            `;
                            stockList.appendChild(div);
                            
                            // Show/hide quantity input based on checkbox
                            document.getElementById(`stock-${stock._id}`).addEventListener('change', (e) => {
                                const configDiv = document.getElementById(`config-${stock._id}`);
                                configDiv.style.display = e.target.checked ? 'block' : 'none';
                            });
                        });
                    })
                    .catch(error => console.error('Error loading product:', error));
            })
            .catch(error => console.error('Error loading stock items:', error));
        
        stockConfigModal.show();
    };

    // Save stock configuration
    window.saveStockConfiguration = function() {
        const productId = document.getElementById('config-product-id').value;
        const stockItems = [];
        
        document.querySelectorAll('.stock-check:checked').forEach(checkbox => {
            const stockId = checkbox.getAttribute('data-stock-id');
            const quantity = parseFloat(document.getElementById(`quantity-${stockId}`).value) || 0;
            
            if (quantity > 0) {
                stockItems.push({
                    stock_id: stockId,
                    quantity_per_unit: quantity
                });
            }
        });
        
        // Get current product data and update with stock items
        fetch(`/api/products/${productId}`)
            .then(response => response.json())
            .then(product => {
                return fetch(`/api/products/${productId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: product.name,
                        category: product.category || 'other',
                        price: product.price,
                        base_price: product.base_price,
                        stock_items: stockItems
                    })
                });
            })
            .then(response => response.json())
            .then(data => {
                alert('Stock configuration saved!');
                stockConfigModal.hide();
                loadProducts();
            })
            .catch(error => {
                console.error('Error saving stock configuration:', error);
                alert('Error saving stock configuration!');
            });
    };

    // Initial load
    loadProducts();
    loadSalesSummary(salesDateInput.value);
});