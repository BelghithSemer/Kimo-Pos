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
    const deleteExpenseModal = new bootstrap.Modal(document.getElementById('deleteExpenseModal'));
    let expenseToDelete = null;
    
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('expense-date').value = today;
    document.getElementById('filter-end-date').value = today;
    
    // Set start of month for filter
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    document.getElementById('filter-start-date').value = startOfMonth.toISOString().split('T')[0];
    
    // Currency formatter
    function formatCurrency(amount) {
        return `${amount.toFixed(2)} TND`;
    }

    // Get category badge class
    function getCategoryBadge(category) {
        const badges = {
            'stock': 'bg-primary',
            'rent': 'bg-secondary',
            'salary': 'bg-success',
            'utilities': 'bg-warning text-dark',
            'maintenance': 'bg-info',
            'marketing': 'bg-dark',
            'other': 'bg-secondary'
        };
        return badges[category] || 'bg-secondary';
    }
    
    // Load expense period summaries
    function loadExpenseSummaries() {
        // Load today's expenses
        fetch('/api/expenses/today')
            .then(response => response.json())
            .then(data => {
                document.getElementById('today-expenses').textContent = formatCurrency(data.total);
                document.getElementById('today-count').textContent = `${data.count} expense${data.count !== 1 ? 's' : ''}`;
            })
            .catch(error => console.error('Error loading today expenses:', error));

        // Load this week's expenses
        fetch('/api/expenses/week')
            .then(response => response.json())
            .then(data => {
                document.getElementById('week-expenses').textContent = formatCurrency(data.total);
                document.getElementById('week-count').textContent = `${data.count} expense${data.count !== 1 ? 's' : ''}`;
            })
            .catch(error => console.error('Error loading week expenses:', error));

        // Load this month's expenses
        fetch('/api/expenses/month')
            .then(response => response.json())
            .then(data => {
                document.getElementById('month-expenses').textContent = formatCurrency(data.total);
                document.getElementById('month-count').textContent = `${data.count} expense${data.count !== 1 ? 's' : ''}`;
            })
            .catch(error => console.error('Error loading month expenses:', error));
    }
    
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
    
    // Load expenses
    function loadExpenses(startDate, endDate) {
        const url = `/api/expenses?startDate=${startDate}&endDate=${endDate}`;
        fetch(url)
            .then(response => response.json())
            .then(expenses => {
                const expensesTable = document.getElementById('expenses-table');
                const expensesMobile = document.getElementById('expenses-mobile');
                const emptyState = document.getElementById('empty-state');
                
                expensesTable.innerHTML = '';
                expensesMobile.innerHTML = '';
                
                if (expenses.length === 0) {
                    emptyState.classList.remove('d-none');
                    return;
                }
                
                emptyState.classList.add('d-none');
                
                expenses.forEach(expense => {
                    const date = new Date(expense.date).toLocaleDateString();
                    const categoryClass = `category-${expense.category}`;
                    const badgeClass = getCategoryBadge(expense.category);
                    
                    // Desktop table row
                    const tr = document.createElement('tr');
                    tr.className = categoryClass;
                    tr.innerHTML = `
                        <td>${date}</td>
                        <td>${expense.description}</td>
                        <td><span class="badge ${badgeClass}">${expense.category}</span></td>
                        <td><strong>${formatCurrency(expense.amount)}</strong></td>
                        <td>
                            <button class="btn btn-sm btn-danger delete-expense" data-expense-id="${expense._id}">
                                Delete
                            </button>
                        </td>
                    `;
                    expensesTable.appendChild(tr);

                    // Mobile card
                    const mobileCard = document.createElement('div');
                    mobileCard.className = `expense-card ${categoryClass}`;
                    mobileCard.innerHTML = `
                        <div class="expense-header">
                            <strong>${expense.description}</strong>
                            <span class="badge ${badgeClass}">${expense.category}</span>
                        </div>
                        <div class="expense-details">
                            <div><strong>Date:</strong> ${date}</div>
                            <div><strong>Amount:</strong> ${formatCurrency(expense.amount)}</div>
                        </div>
                        <div class="expense-actions">
                            <button class="btn btn-sm btn-danger delete-expense" data-expense-id="${expense._id}">
                                Delete
                            </button>
                        </div>
                    `;
                    expensesMobile.appendChild(mobileCard);
                });

                // Add event listeners for delete buttons
                document.querySelectorAll('.delete-expense').forEach(button => {
                    button.addEventListener('click', function() {
                        const expenseId = this.getAttribute('data-expense-id');
                        showDeleteConfirmation(expenseId, expenses);
                    });
                });
            })
            .catch(error => console.error('Error loading expenses:', error));
    }

    // Show delete confirmation
    function showDeleteConfirmation(expenseId, expenses) {
        const expense = expenses.find(e => e._id === expenseId);
        if (!expense) return;

        expenseToDelete = expenseId;
        const detailsDiv = document.getElementById('delete-expense-details');
        
        detailsDiv.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <h6>${expense.description}</h6>
                    <p class="mb-1"><strong>Category:</strong> ${expense.category}</p>
                    <p class="mb-1"><strong>Amount:</strong> ${formatCurrency(expense.amount)}</p>
                    <p class="mb-0"><strong>Date:</strong> ${new Date(expense.date).toLocaleDateString()}</p>
                </div>
            </div>
        `;
        
        deleteExpenseModal.show();
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
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            alert('Expense added successfully!');
            document.getElementById('add-expense-form').reset();
            document.getElementById('expense-date').value = today;
            filterExpenses();
            loadExpenseSummaries();
        })
        .catch(error => {
            console.error('Error adding expense:', error);
            alert('Error adding expense!');
        });
    });
    
    // Delete expense
    function deleteExpense(expenseId) {
        fetch(`/api/expenses/${expenseId}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            alert('Expense deleted successfully!');
            deleteExpenseModal.hide();
            filterExpenses();
            loadExpenseSummaries();
        })
        .catch(error => {
            console.error('Error deleting expense:', error);
            alert('Error deleting expense!');
        });
    }
    
    // Filter expenses
    window.filterExpenses = function() {
        const startDate = document.getElementById('filter-start-date').value;
        const endDate = document.getElementById('filter-end-date').value;
        loadExpenses(startDate, endDate);
    };

    // Delete confirmation
    document.getElementById('confirm-delete-btn').addEventListener('click', () => {
        if (expenseToDelete) {
            deleteExpense(expenseToDelete);
            expenseToDelete = null;
        }
    });
    
    // Initial load
    loadExpenseSummaries();
    filterExpenses();
});