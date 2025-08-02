const express = require('express');
const router = express.Router();
const { Order, Product, Stock, StockMovement } = require('../database/db');
const { Parser } = require('json2csv');

// Create new order
router.post('/', async (req, res) => {
    try {
        const { items } = req.body;
        const orderNumber = 'ORD-' + Date.now();
        
        let total = 0;
        let baseTotal = 0;
        
        // Calculate totals
        items.forEach(item => {
            total += item.price;
            baseTotal += item.base_price || 0;
        });
        
        // Create order
        const order = new Order({
            order_number: orderNumber,
            items: items.map(item => ({
                product_id: item.id,
                product_name: item.name,
                price: item.price,
                base_price: item.base_price || 0,
                quantity: 1
            })),
            total,
            base_total: baseTotal
        });
        
        await order.save();
        
        // Update stock for each item
        for (const item of items) {
            const product = await Product.findById(item.id).populate('stock_items.stock_id');
            
            if (product && product.stock_items) {
                for (const stockItem of product.stock_items) {
                    if (stockItem.stock_id && stockItem.quantity_per_unit > 0) {
                        const stock = await Stock.findById(stockItem.stock_id);
                        if (stock) {
                            // Decrease stock
                            stock.current_quantity -= stockItem.quantity_per_unit;
                            stock.last_updated = Date.now();
                            await stock.save();
                            
                            // Record movement
                            const movement = new StockMovement({
                                stock_id: stock._id,
                                type: 'sale',
                                quantity: -stockItem.quantity_per_unit,
                                reference_type: 'order',
                                reference_id: order._id
                            });
                            await movement.save();
                        }
                    }
                }
            }
        }
        
        res.json({
            id: order._id,
            order_number: order.order_number,
            total: order.total,
            base_total: order.base_total,
            status: order.status
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all orders for today
router.get('/today', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const orders = await Order.find({
            timestamp: { $gte: today, $lt: tomorrow }
        }).sort({ timestamp: -1 });
        
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get orders by date
router.get('/date/:date', async (req, res) => {
    try {
        const date = new Date(req.params.date);
        date.setHours(0, 0, 0, 0);
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        
        const orders = await Order.find({
            timestamp: { $gte: date, $lt: nextDay }
        }).sort({ timestamp: -1 });
        
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get order details
router.get('/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update order status
router.put('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get daily sales summary
router.get('/summary/:date', async (req, res) => {
    try {
        const date = new Date(req.params.date);
        date.setHours(0, 0, 0, 0);
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        
        const orders = await Order.find({
            timestamp: { $gte: date, $lt: nextDay }
        });
        
        // Aggregate product sales
        const productSales = {};
        orders.forEach(order => {
            order.items.forEach(item => {
                if (!productSales[item.product_name]) {
                    productSales[item.product_name] = {
                        quantity_sold: 0,
                        total_revenue: 0,
                        total_cost: 0,
                        profit: 0
                    };
                }
                productSales[item.product_name].quantity_sold += 1;
                productSales[item.product_name].total_revenue += item.price;
                productSales[item.product_name].total_cost += item.base_price;
                productSales[item.product_name].profit += (item.price - item.base_price);
            });
        });
        
        const products = Object.keys(productSales).map(name => ({
            product_name: name,
            ...productSales[name]
        }));
        
        const totals = {
            total_orders: orders.length,
            total_revenue: orders.reduce((sum, order) => sum + order.total, 0),
            total_cost: orders.reduce((sum, order) => sum + order.base_total, 0),
            total_profit: orders.reduce((sum, order) => sum + (order.total - order.base_total), 0)
        };
        
        res.json({
            date: req.params.date,
            totals,
            products
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Export orders to CSV
router.post('/export', async (req, res) => {
    try {
        const { startDate, endDate } = req.body;
        
        const orders = await Order.find({
            timestamp: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            }
        });
        
        // Flatten order items for CSV
        const csvData = [];
        orders.forEach(order => {
            order.items.forEach(item => {
                csvData.push({
                    order_number: order.order_number,
                    timestamp: order.timestamp,
                    product_name: item.product_name,
                    price: item.price,
                    base_price: item.base_price,
                    profit: item.price - item.base_price,
                    status: order.status
                });
            });
        });
        
        const fields = ['order_number', 'timestamp', 'product_name', 'price', 'base_price', 'profit', 'status'];
        const json2csv = new Parser({ fields });
        const csv = json2csv.parse(csvData);
        
        res.header('Content-Type', 'text/csv');
        res.attachment(`sales_${startDate}_to_${endDate}.csv`);
        res.send(csv);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;