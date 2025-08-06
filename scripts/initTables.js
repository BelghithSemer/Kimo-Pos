// scripts/initTables.js
const mongoose = require('mongoose');
require('dotenv').config();
const { Table } = require('../backend/database/db');

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    console.log('Connected to MongoDB Atlas');
    // Initialize 16 tables
    for (let i = 1; i <= 16; i++) {
        await Table.findOneAndUpdate(
            { table_number: i },
            { table_number: i, status: 'free', current_order: null },
            { upsert: true, new: true }
        );
        console.log(`Table ${i} initialized.`);
    }
    console.log('All tables initialized.');
    mongoose.connection.close();
}).catch(err => {
    console.error('MongoDB connection error:', err);
});