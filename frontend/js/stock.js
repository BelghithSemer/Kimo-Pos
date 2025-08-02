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
    const adjustStockModal = new bootstrap.Modal(document.getElementById('adjustStockModal'));
    
    // Load stock items
    function loadStockItems() {
        fetch('/api/stock')
            .then(response => response.json())
            .then(stockItems => {
                const stockTable = document.getElementById('stock-table');
                const stockAlerts = document.getElementById('stock-alerts');
                stockTable.innerHTML = '';
                stockAlerts.innerHTML = '';
                
                let lowStockCount = 0;
                
                stockItems.forEach(item => {
                    const totalValue = item.current_quantity * item.cost_per_unit;
                    const statusClass = item.current_quantity <= item.minimum_quantity ? 'stock-danger' : 
                                      item.current_quantity <= item.minimum_quantity * 1.5 ? 'stock-warning' : 'stock-good';
                    const statusText = item.current_quantity <= item.minimum_quantity ? 'Low' : 
                                     item.current_quantity <= item.minimum_quantity * 1.5 ? 'Warning' : 'Good';
                    
                    // Add alert if low stock
                    if (item.current_quantity <= item.minimum_quantity) {
                        lowStockCount++;
                        const alert = document.createElement('div');
                        alert.className = 'stock-alert';
                        alert.innerHTML = `⚠️ <strong>${item.name}</strong> is low on stock! Current: ${item.current_quantity} ${item.unit}, Minimum: ${item.minimum_quantity} ${item.unit}`;
                        stockAlerts.appendChild(alert);
                    }
                    
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${item.name}</td>
                        <td>${item.category}</td>
                        <td>${item.current_quantity}</td>
                        <td>${item.minimum_quantity}</td>
                        <td>${item.unit}</td>
                        <td><span class="currency">${item.cost_per_unit.toFixed(2)}</span></td>
                        <td><span class="currency">${totalValue.toFixed(2)}</span></td>
                        <td><span class="${statusClass}">${statusText}</span></td>
                        <td>
                            <button class="btn btn-sm btn-primary" onclick="showAdjustModal('${item._id}')">Adjust</button>
                            <button class="btn btn-sm btn-danger" onclick="deleteStock('${item._id}')">Delete</button>
                        </td>
                    `;
                    stockTable.appendChild(tr);
                });
                
                if (lowStockCount === 0) {
                    stockAlerts.innerHTML = '<div class="alert alert-success">All stock levels are good!</div>';
                }
            })
            .catch(error => console.error('Error loading stock:', error));
    }
    
    // Add stock item
    document.getElementById('add-stock-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const stockData = {
            name: document.getElementById('stock-name').value,
            category: document.getElementById('stock-category').value,
            unit: document.getElementById('stock-unit').value,
            current_quantity: parseFloat(document.getElementById('stock-quantity').value),
            minimum_quantity: parseFloat(document.getElementById('stock-minimum').value),
            cost_per_unit: parseFloat(document.getElementById('stock-cost').value)
        };
        
        fetch('/api/stock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stockData)
        })
        .then(response => response.json())
        .then(data => {
            alert('Stock item added successfully!');
            document.getElementById('add-stock-form').reset();
            loadStockItems();
        })
        .catch(error => {
            console.error('Error adding stock:', error);
            alert('Error adding stock item!');
        });
    });
    
    // Show adjust modal
    window.showAdjustModal = function(stockId) {
        document.getElementById('adjust-stock-id').value = stockId;
        document.getElementById('adjust-quantity').value = '';
        document.getElementById('adjust-type').value = 'adjustment';
        adjustStockModal.show();
    };
    
    // Submit stock adjustment
    window.submitStockAdjustment = function() {
        const stockId = document.getElementById('adjust-stock-id').value;
        const quantity = parseFloat(document.getElementById('adjust-quantity').value);
        const type = document.getElementById('adjust-type').value;
        
        fetch(`/api/stock/${stockId}/adjust`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity, type })
        })
        .then(response => response.json())
        .then(data => {
            alert('Stock adjusted successfully!');
            adjustStockModal.hide();
            loadStockItems();
        })
        .catch(error => {
            console.error('Error adjusting stock:', error);
            alert('Error adjusting stock!');
        });
    };
    
    // Delete stock item
    window.deleteStock = function(stockId) {
        if (confirm('Are you sure you want to delete this stock item?')) {
            fetch(`/api/stock/${stockId}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(data => {
                alert('Stock item deleted successfully!');
                loadStockItems();
            })
            .catch(error => {
                console.error('Error deleting stock:', error);
                alert('Error deleting stock item!');
            });
        }
    };
    
    // Initial load
    loadStockItems();
});