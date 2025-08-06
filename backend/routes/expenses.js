const express = require('express');
const router = express.Router();
const { Expense, Stock, StockMovement } = require('../database/db');

// Get expenses by date range
router.get('/', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let query = {};
        
        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        const expenses = await Expense.find(query)
            .populate('stock_id')
            .sort({ date: -1 });
        res.json(expenses);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get today's expenses total
router.get('/today', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const expenses = await Expense.find({
            date: { $gte: today, $lt: tomorrow }
        });
        
        const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        
        res.json({
            total,
            count: expenses.length,
            expenses: expenses
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get this week's expenses total
router.get('/week', async (req, res) => {
    try {
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
        startOfWeek.setHours(0, 0, 0, 0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);
        
        const expenses = await Expense.find({
            date: { $gte: startOfWeek, $lt: endOfWeek }
        });
        
        const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        
        res.json({
            total,
            count: expenses.length,
            startDate: startOfWeek,
            endDate: endOfWeek,
            expenses: expenses
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get this month's expenses total
router.get('/month', async (req, res) => {
    try {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        
        const expenses = await Expense.find({
            date: { $gte: startOfMonth, $lt: endOfMonth }
        });
        
        const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        
        res.json({
            total,
            count: expenses.length,
            startDate: startOfMonth,
            endDate: endOfMonth,
            expenses: expenses
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add new expense
router.post('/', async (req, res) => {
    try {
        const { description, amount, category, stock_id, quantity, date } = req.body;
        
        const expense = new Expense({
            description,
            amount,
            category,
            stock_id,
            quantity,
            date: date || Date.now()
        });
        
        await expense.save();
        
        // If this is a stock purchase, update stock quantity
        if (category === 'stock' && stock_id && quantity) {
            const stock = await Stock.findById(stock_id);
            if (stock) {
                stock.current_quantity += quantity;
                stock.last_updated = Date.now();
                await stock.save();
                
                // Record stock movement
                const movement = new StockMovement({
                    stock_id: stock._id,
                    type: 'purchase',
                    quantity: quantity,
                    reference_type: 'expense',
                    reference_id: expense._id
                });
                await movement.save();
            }
        }
        
        res.json(expense);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update expense
router.put('/:id', async (req, res) => {
    try {
        const { description, amount, category, date } = req.body;
        const expense = await Expense.findByIdAndUpdate(
            req.params.id,
            { description, amount, category, date },
            { new: true }
        );
        if (!expense) {
            return res.status(404).json({ error: 'Expense not found' });
        }
        res.json(expense);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete expense
router.delete('/:id', async (req, res) => {
    try {
        const expense = await Expense.findByIdAndDelete(req.params.id);
        if (!expense) {
            return res.status(404).json({ error: 'Expense not found' });
        }
        res.json({ message: 'Expense deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get daily summary (revenue - expenses)
router.get('/summary/:date', async (req, res) => {
    try {
        const date = new Date(req.params.date);
        const startOfDay = new Date(date.setHours(0, 0, 0, 0));
        const endOfDay = new Date(date.setHours(23, 59, 59, 999));
        
        // Get expenses for the day
        const expenses = await Expense.find({
            date: { $gte: startOfDay, $lte: endOfDay }
        });
        
        const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        
        // Get orders for the day
        const Order = require('../database/db').Order;
        const orders = await Order.find({
            timestamp: { $gte: startOfDay, $lte: endOfDay },
            status: 'paid'
        });
        
        const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
        const totalCost = orders.reduce((sum, order) => sum + order.base_total, 0);
        const grossProfit = totalRevenue - totalCost;
        const netProfit = grossProfit - totalExpenses;
        
        res.json({
            date: req.params.date,
            revenue: totalRevenue,
            cost_of_goods: totalCost,
            gross_profit: grossProfit,
            expenses: totalExpenses,
            net_profit: netProfit,
            expense_breakdown: expenses
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;