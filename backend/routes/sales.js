const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { Parser } = require('json2csv');

// Handle sales export
router.post('/export', (req, res) => {
    const saleItems = req.body.sale;
    
    // Insert sales items into database
    const stmt = db.prepare('INSERT INTO sales (product_id, name, price) VALUES (?, ?, ?)');
    saleItems.forEach(item => {
        stmt.run(item.id, item.name, item.price);
    });
    stmt.finalize(() => {
        // Export today's sales
        const today = new Date().toISOString().split('T')[0];
        db.all('SELECT * FROM sales WHERE DATE(timestamp) = ?', [today], (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            // Convert to CSV
            const fields = ['id', 'product_id', 'name', 'price', 'timestamp'];
            const json2csv = new Parser({ fields });
            const csv = json2csv.parse(rows);
            
            res.header('Content-Type', 'text/csv');
            res.attachment(`sales_${today}.csv`);
            res.send(csv);
        });
    });
});

// Get all sales
router.get('/', (req, res) => {
    db.all('SELECT * FROM sales ORDER BY timestamp DESC', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Get today's sales
router.get('/today', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    db.all('SELECT * FROM sales WHERE DATE(timestamp) = ?', [today], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

module.exports = router;