const express = require('express');
const router = express.Router();
const { Order, Table, PromoSlide } = require('../database/db');

// @route   POST api/client/order
// @desc    Create a new order
// @access  Public
router.post('/order', async (req, res) => {
    const { tableNumber, items } = req.body;

    if (!tableNumber || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ msg: 'Please provide a table number and items for the order.' });
    }

    try {
        // Find the table by its number
        const table = await Table.findOne({ table_number: tableNumber });
        if (!table) {
            return res.status(404).json({ msg: 'Table not found.' });
        }

        // You might want to add more validation for items, e.g., check if products exist and get their current price
        // For now, we'll assume the client sends correct product data (name, price, etc.)

        // Calculate total
        const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0);

        // Generate a unique order number (you might have a more sophisticated way of doing this)
        const order_number = `T${tableNumber}-${Date.now()}`;

        const newOrder = new Order({
            order_number,
            table_id: table._id,
            items,
            total,
            status: 'pending', // as requested
            order_type: 'dine-in'
        });

        const order = await newOrder.save();

        // Optionally, you can associate the pending order with the table, but the cashier confirmation step is where the table becomes "occupied"
        // table.current_order = order._id;
        // await table.save();

        res.status(201).json(order);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/client/promos
// @desc    Get active promotional slides
// @access  Public
router.get('/promos', async (req, res) => {
    try {
        const promos = await PromoSlide.find({
            active: true,
            $or: [
                { expiryDate: { $exists: false } },
                { expiryDate: null },
                { expiryDate: { $gt: new Date() } }
            ]
        });
        res.json(promos);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
