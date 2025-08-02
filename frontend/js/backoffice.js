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
    
    // Load products
    function loadProducts() {
        fetch('/api/products')
            .then(response => response.json())
            .then(products => {
                const productsTable = document.getElementById('products-table');
                productsTable.innerHTML = '';
                
                products.forEach(product => {
                    const profit = product.price - (product.base_price || 0);
                    const profitMargin = product.price > 0 ? ((profit / product.price) * 100).toFixed(1) : 0;
                    
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${product._id}</td>
                        <td>
                            <input type="text" class="form-control" value="${product.name}" id="name-${product._id}">
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
                            <button class="btn btn-sm btn-success save-btn" data-id="${product._id}">Save</button>
                            <button class="btn btn-sm btn-info" onclick="configureStock('${product._id}')">Stock</button>
                            <button class="btn btn-sm btn-danger delete-btn" data-id="${product._id}">Delete</button>
                        </td>
                    `;
                    productsTable.appendChild(tr);
                });

                // Add event listeners for save buttons
                document.querySelectorAll('.save-btn').forEach(button => {
                    button.addEventListener('click', () => {
                        const id = button.getAttribute('data-id');
                        const name = document.getElementById(`name-${id}`).value;
                        const price = parseFloat(document.getElementById(`price-${id}`).value);
                        const basePrice = parseFloat(document.getElementById(`base-price-${id}`).value);

                        if (!name || isNaN(price) || isNaN(basePrice)) {
                            alert('Please enter valid values!');
                            return;
                        }

                        fetch(`/api/products/${id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name, price, base_price: basePrice })
                        })
                        .then(response => response.json())
                        .then(data => {
                            alert('Product updated successfully!');
                            loadProducts(); // Reload to update profit display
                        })
                        .catch(error => {
                            console.error('Error updating product:', error);
                            alert('Error updating product!');
                        });
                    });
                });

                // Add event listeners for delete buttons
                document.querySelectorAll('.delete-btn').forEach(button => {
                    button.addEventListener('click', () => {
                        const id = button.getAttribute('data-id');
                        
                        if (confirm('Are you sure you want to delete this product?')) {
                            fetch(`/api/products/${id}`, {
                                method: 'DELETE'
                            })
                            .then(response => response.json())
                            .then(data => {
                                alert('Product deleted successfully!');
                                loadProducts();
                            })
                            .catch(error => {
                                console.error('Error deleting product:', error);
                                alert('Error deleting product!');
                            });
                        }
                    });
                });
            })
            .catch(error => console.error('Error loading products:', error));
    }

    // Handle add product form submission
    document.getElementById('add-product-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const name = document.getElementById('product-name').value;
        const price = parseFloat(document.getElementById('product-price').value);
        const basePrice = parseFloat(document.getElementById('product-base-price').value);

        if (!name || isNaN(price) || isNaN(basePrice)) {
            alert('Please enter valid values!');
            return;
        }

        fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, price, base_price: basePrice })
        })
        .then(response => response.json())
        .then(data => {
            alert('Product added successfully!');
            document.getElementById('add-product-form').reset();
            loadProducts(); // Reload the table
        })
        .catch(error => {
            console.error('Error adding product:', error);
            alert('Error adding product!');
        });
    });

    // Load sales summary
    function loadSalesSummary(date) {
        fetch(`/api/orders/summary/${date}`)
            .then(response => response.json())
            .then(data => {
                const summaryDiv = document.getElementById('sales-summary');
                
                if (!data.totals || data.totals.total_orders === 0) {
                    summaryDiv.innerHTML = '<p class="text-center text-muted">No sales data for this date</p>';
                    return;
                }
                
                let html = `
                    <div class="row mb-4">
                        <div class="col-md-3">
                            <div class="card text-center">
                                <div class="card-body">
                                    <h5 class="card-title">Total Orders</h5>
                                    <h3 class="text-primary">${data.totals.total_orders}</h3>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card text-center">
                                <div class="card-body">
                                    <h5 class="card-title">Total Revenue</h5>
                                    <h3 class="text-success">${formatCurrency(data.totals.total_revenue)}</h3>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card text-center">
                                <div class="card-body">
                                    <h5 class="card-title">Total Cost</h5>
                                    <h3 class="text-warning">${formatCurrency(data.totals.total_cost)}</h3>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card text-center">
                                <div class="card-body">
                                    <h5 class="card-title">Total Profit</h5>
                                    <h3 class="text-info">${formatCurrency(data.totals.total_profit)}</h3>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <h4>Product Sales Breakdown</h4>
                    <div class="table-responsive">
                        <table class="table table-striped">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Quantity Sold</th>
                                    <th>Revenue</th>
                                    <th>Cost</th>
                                    <th>Profit</th>
                                    <th>Profit Margin</th>
                                </tr>
                            </thead>
                            <tbody>
                `;
                
                data.products.forEach(product => {
                    const profitMargin = product.total_revenue > 0 ? 
                        ((product.profit / product.total_revenue) * 100).toFixed(1) : 0;
                    
                    html += `
                        <tr>
                            <td>${product.product_name}</td>
                            <td>${product.quantity_sold}</td>
                            <td>${formatCurrency(product.total_revenue)}</td>
                            <td>${formatCurrency(product.total_cost)}</td>
                            <td>${formatCurrency(product.profit)}</td>
                            <td>${profitMargin}%</td>
                        </tr>
                    `;
                });
                
                html += `
                            </tbody>
                        </table>
                    </div>
                `;
                
                summaryDiv.innerHTML = html;
            })
            .catch(error => {
                console.error('Error loading sales summary:', error);
                document.getElementById('sales-summary').innerHTML = 
                    '<p class="text-center text-danger">Error loading sales data</p>';
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