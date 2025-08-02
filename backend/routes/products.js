const express = require('express');
const router = express.Router();
const { Product, Stock } = require('../database/db');

// Get all products
router.get('/', async (req, res) => {
    try {
        const products = await Product.find().populate('stock_items.stock_id');
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single product
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('stock_items.stock_id');
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add new product
router.post('/', async (req, res) => {
    try {
        const { name, price, base_price, stock_items } = req.body;
        const product = new Product({
            name,
            price,
            base_price: base_price || 0,
            stock_items: stock_items || []
        });
        await product.save();
        res.json(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update product
router.put('/:id', async (req, res) => {
    try {
        const { name, price, base_price, stock_items } = req.body;
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            { name, price, base_price, stock_items },
            { new: true }
        );
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete product
router.delete('/:id', async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json({ message: 'Product deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;