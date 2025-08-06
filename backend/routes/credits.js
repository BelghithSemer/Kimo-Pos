const express = require('express');
const router = express.Router();
const { CreditCustomer, CreditOrder, CreditPayment, Table } = require('../database/db');

// Get all credit customers
router.get('/customers', async (req, res) => {
    try {
        const customers = await CreditCustomer.find().sort({ name: 1 });
        res.json(customers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create new credit customer
router.post('/customers', async (req, res) => {
    try {
        const { name, phone, address } = req.body;
        
        // Check if customer already exists
        const existingCustomer = await CreditCustomer.findOne({ name: name.trim() });
        if (existingCustomer) {
            return res.status(400).json({ error: 'Customer with this name already exists' });
        }
        
        const customer = new CreditCustomer({
            name: name.trim(),
            phone: phone || '',
            address: address || ''
        });
        
        await customer.save();
        res.json(customer);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create credit order
router.post('/orders', async (req, res) => {
    try {
        const { items, customer_id, customer_name, table_id, order_type } = req.body;
        const orderNumber = 'CREDIT-' + Date.now();
        
        let total = 0;
        let baseTotal = 0;
        
        // Calculate totals
        items.forEach(item => {
            total += item.price * (item.quantity || 1);
            baseTotal += (item.base_price || 0) * (item.quantity || 1);
        });
        
        // Create credit order
        const creditOrder = new CreditOrder({
            order_number: orderNumber,
            customer_id,
            customer_name,
            table_id: table_id || null,
            order_type: order_type || 'dine-in',
            items: items.map(item => ({
                product_id: item.id,
                product_name: item.name,
                price: item.price,
                base_price: item.base_price || 0,
                quantity: item.quantity || 1
            })),
            total,
            base_total: baseTotal,
            remaining_balance: total
        });
        
        await creditOrder.save();
        
        // Update customer's total credit
        await CreditCustomer.findByIdAndUpdate(customer_id, {
            $inc: { total_credit: total },
            last_transaction: Date.now()
        });
        
        // Update table status if dine-in
        if (order_type === 'dine-in' && table_id) {
            await Table.findByIdAndUpdate(table_id, {
                status: 'occupied',
                current_order: null // Credit orders don't occupy tables the same way
            });
        }
        
        res.json(creditOrder);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get credit orders
router.get('/orders', async (req, res) => {
    try {
        const { customer_id, status } = req.query;
        let query = {};
        
        if (customer_id) query.customer_id = customer_id;
        if (status) query.status = status;
        
        const orders = await CreditOrder.find(query)
            .populate('customer_id')
            .sort({ timestamp: -1 });
        
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single credit order
router.get('/orders/:id', async (req, res) => {
    try {
        const order = await CreditOrder.findById(req.params.id)
            .populate('customer_id');
        
        if (!order) {
            return res.status(404).json({ error: 'Credit order not found' });
        }
        
        // Get payment history
        const payments = await CreditPayment.find({ credit_order_id: order._id })
            .sort({ timestamp: -1 });
        
        res.json({ order, payments });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add payment to credit order
router.post('/orders/:id/payments', async (req, res) => {
    try {
        const { amount, payment_method, notes } = req.body;
        const orderId = req.params.id;
        
        const order = await CreditOrder.findById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Credit order not found' });
        }
        
        if (amount <= 0 || amount > order.remaining_balance) {
            return res.status(400).json({ error: 'Invalid payment amount' });
        }
        
        // Create payment record
        const payment = new CreditPayment({
            credit_order_id: orderId,
            customer_id: order.customer_id,
            amount,
            payment_method: payment_method || 'cash',
            notes: notes || ''
        });
        
        await payment.save();
        
        // Update order
        const newPaidAmount = order.amount_paid + amount;
        const newRemainingBalance = order.total - newPaidAmount;
        const newStatus = newRemainingBalance <= 0 ? 'paid' : 'partial';
        
        await CreditOrder.findByIdAndUpdate(orderId, {
            amount_paid: newPaidAmount,
            remaining_balance: newRemainingBalance,
            status: newStatus
        });
        
        // Update customer's total credit
        await CreditCustomer.findByIdAndUpdate(order.customer_id, {
            $inc: { total_credit: -amount },
            last_transaction: Date.now()
        });
        
        res.json(payment);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get customer summary
router.get('/customers/:id/summary', async (req, res) => {
    try {
        const customerId = req.params.id;
        
        const customer = await CreditCustomer.findById(customerId);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        
        const orders = await CreditOrder.find({ customer_id: customerId });
        const totalOrders = orders.length;
        const pendingOrders = orders.filter(o => o.status === 'pending').length;
        const partialOrders = orders.filter(o => o.status === 'partial').length;
        const paidOrders = orders.filter(o => o.status === 'paid').length;
        
        res.json({
            customer,
            totalOrders,
            pendingOrders,
            partialOrders,
            paidOrders,
            recentOrders: orders.slice(0, 5)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;