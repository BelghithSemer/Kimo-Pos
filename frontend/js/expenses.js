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
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('summary-date').value = today;
    document.getElementById('expense-date').value = today;
    document.getElementById('filter-end-date').value = today;
    
    // Set start of month for filter
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    document.getElementById('filter-start-date').value = startOfMonth.toISOString().split('T')[0];
    
    // Load stock items for dropdown
    function loadStockItems() {
        fetch('/api/stock')
            .then(response => response.json())
            .then(stockItems => {
                const stockSelect = document.getElementById('expense-stock');
                stockSelect.innerHTML = '<option value="">Select Stock Item</option>';
                stockItems.forEach(item => {
                    stockSelect.innerHTML += `<option value="${item._id}">${item.name} (${item.unit})</option>`;
                });
            })
            .catch(error => console.error('Error loading stock items:', error));
    }
    
    // Show/hide stock fields based on category
    document.getElementById('expense-category').addEventListener('change', (e) => {
        const stockFields = document.getElementById('stock-purchase-fields');
        if (e.target.value === 'stock') {
            stockFields.style.display = 'block';
            loadStockItems();
        } else {
            stockFields.style.display = 'none';
        }
    });
    
    // Load daily summary
    function loadDailySummary(date) {
        fetch(`/api/expenses/summary/${date}`)
            .then(response => response.json())
            .then(summary => {
                const summaryDiv = document.getElementById('daily-summary');
                summaryDiv.innerHTML = `
                    <div class="col-md-3">
                        <div class="dashboard-card bg-success text-white">
                            <h5>Revenue</h5>
                            <h3 class="currency">${summary.revenue.toFixed(2)}</h3>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="dashboard-card bg-warning text-dark">
                            <h5>Cost of Goods</h5>
                            <h3 class="currency">${summary.cost_of_goods.toFixed(2)}</h3>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="dashboard-card bg-danger text-white">
                            <h5>Expenses</h5>
                            <h3 class="currency">${summary.expenses.toFixed(2)}</h3>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="dashboard-card ${summary.net_profit >= 0 ? 'bg-info' : 'bg-dark'} text-white">
                            <h5>Net Profit</h5>
                            <h3 class="currency">${summary.net_profit.toFixed(2)}</h3>
                        </div>
                    </div>
                `;
            })
            .catch(error => console.error('Error loading summary:', error));
    }
    
    // Load expenses
    function loadExpenses(startDate, endDate) {
        const url = `/api/expenses?startDate=${startDate}&endDate=${endDate}`;
        fetch(url)
            .then(response => response.json())
            .then(expenses => {
                const expensesTable = document.getElementById('expenses-table');
                expensesTable.innerHTML = '';
                
                if (expenses.length === 0) {
                    expensesTable.innerHTML = '<tr><td colspan="5" class="text-center">No expenses found</td></tr>';
                    return;
                }
                
                expenses.forEach(expense => {
                    const date = new Date(expense.date).toLocaleDateString();
                    const categoryClass = `expense-${expense.category}`;
                    
                    const tr = document.createElement('tr');
                    tr.className = categoryClass;
                    tr.innerHTML = `
                        <td>${date}</td>
                        <td>${expense.description}</td>
                        <td>${expense.category}</td>
                        <td><span class="currency">${expense.amount.toFixed(2)}</span></td>
                        <td>
                            <button class="btn btn-sm btn-danger" onclick="deleteExpense('${expense._id}')">Delete</button>
                        </td>
                    `;
                    expensesTable.appendChild(tr);
                });
            })
            .catch(error => console.error('Error loading expenses:', error));
    }
    
    // Add expense
    document.getElementById('add-expense-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const expenseData = {
            description: document.getElementById('expense-description').value,
            amount: parseFloat(document.getElementById('expense-amount').value),
            category: document.getElementById('expense-category').value,
            date: document.getElementById('expense-date').value
        };
        
        // Add stock info if it's a stock purchase
        if (expenseData.category === 'stock') {
            const stockId = document.getElementById('expense-stock').value;
            const quantity = parseFloat(document.getElementById('expense-quantity').value);
            if (stockId && quantity) {
                expenseData.stock_id = stockId;
                expenseData.quantity = quantity;
            }
        }
        
        fetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(expenseData)
        })
        .then(response => response.json())
        .then(data => {
            alert('Expense added successfully!');
            document.getElementById('add-expense-form').reset();
            document.getElementById('expense-date').value = today;
            filterExpenses();
            loadDailySummary(document.getElementById('summary-date').value);
        })
        .catch(error => {
            console.error('Error adding expense:', error);
            alert('Error adding expense!');
        });
    });
    
    // Delete expense
    window.deleteExpense = function(expenseId) {
        if (confirm('Are you sure you want to delete this expense?')) {
            fetch(`/api/expenses/${expenseId}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(data => {
                alert('Expense deleted successfully!');
                filterExpenses();
                loadDailySummary(document.getElementById('summary-date').value);
            })
            .catch(error => {
                console.error('Error deleting expense:', error);
                alert('Error deleting expense!');
            });
        }
    };
    
    // Filter expenses
    window.filterExpenses = function() {
        const startDate = document.getElementById('filter-start-date').value;
        const endDate = document.getElementById('filter-end-date').value;
        loadExpenses(startDate, endDate);
    };
    
    // Handle summary date change
    document.getElementById('summary-date').addEventListener('change', (e) => {
        loadDailySummary(e.target.value);
    });
    
    // Initial load
    loadDailySummary(today);
    filterExpenses();
});