const express = require('express');
const router = express.Router();
const { Stock, StockMovement, Product } = require('../database/db');

// Get all stock items
router.get('/', async (req, res) => {
    try {
        const stockItems = await Stock.find();
        res.json(stockItems);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single stock item
router.get('/:id', async (req, res) => {
    try {
        const stock = await Stock.findById(req.params.id);
        if (!stock) {
            return res.status(404).json({ error: 'Stock item not found' });
        }
        res.json(stock);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add new stock item
router.post('/', async (req, res) => {
    try {
        const { name, category, unit, current_quantity, minimum_quantity, cost_per_unit } = req.body;
        const stock = new Stock({
            name,
            category,
            unit,
            current_quantity: current_quantity || 0,
            minimum_quantity: minimum_quantity || 0,
            cost_per_unit: cost_per_unit || 0
        });
        await stock.save();
        res.json(stock);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update stock item
router.put('/:id', async (req, res) => {
    try {
        const { name, category, unit, current_quantity, minimum_quantity, cost_per_unit } = req.body;
        const stock = await Stock.findByIdAndUpdate(
            req.params.id,
            {
                name,
                category,
                unit,
                current_quantity,
                minimum_quantity,
                cost_per_unit,
                last_updated: Date.now()
            },
            { new: true }
        );
        if (!stock) {
            return res.status(404).json({ error: 'Stock item not found' });
        }
        res.json(stock);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Adjust stock quantity
router.post('/:id/adjust', async (req, res) => {
    try {
        const { quantity, type, reference_type, reference_id } = req.body;
        const stock = await Stock.findById(req.params.id);
        
        if (!stock) {
            return res.status(404).json({ error: 'Stock item not found' });
        }
        
        // Update stock quantity
        stock.current_quantity += quantity;
        stock.last_updated = Date.now();
        await stock.save();
        
        // Record the movement
        const movement = new StockMovement({
            stock_id: stock._id,
            type: type || 'adjustment',
            quantity,
            reference_type,
            reference_id
        });
        await movement.save();
        
        res.json({ stock, movement });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get stock movements
router.get('/:id/movements', async (req, res) => {
    try {
        const movements = await StockMovement.find({ stock_id: req.params.id })
            .sort({ timestamp: -1 })
            .limit(50);
        res.json(movements);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get low stock items
router.get('/alerts/low', async (req, res) => {
    try {
        const lowStockItems = await Stock.find({
            $expr: { $lte: ['$current_quantity', '$minimum_quantity'] }
        });
        res.json(lowStockItems);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;