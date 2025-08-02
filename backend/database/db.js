const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB Atlas');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

// Product Schema
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    base_price: { type: Number, default: 0 },
    stock_items: [{
        stock_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Stock' },
        quantity_per_unit: { type: Number, default: 0 } // e.g., 0.011 kg of coffee per cup
    }],
    created_at: { type: Date, default: Date.now }
});

// Order Schema
const orderSchema = new mongoose.Schema({
    order_number: { type: String, required: true, unique: true },
    items: [{
        product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        product_name: String,
        price: Number,
        base_price: Number,
        quantity: { type: Number, default: 1 }
    }],
    total: { type: Number, required: true },
    base_total: { type: Number, default: 0 },
    status: { type: String, default: 'unpaid', enum: ['paid', 'unpaid'] },
    timestamp: { type: Date, default: Date.now }
});

// Stock Schema
const stockSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String, required: true }, // 'ingredient', 'product'
    unit: { type: String, required: true }, // 'kg', 'L', 'piece'
    current_quantity: { type: Number, default: 0 },
    minimum_quantity: { type: Number, default: 0 },
    cost_per_unit: { type: Number, default: 0 },
    last_updated: { type: Date, default: Date.now }
});

// Expense Schema
const expenseSchema = new mongoose.Schema({
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true }, // 'stock', 'rent', 'salary', 'utilities', 'other'
    stock_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Stock', required: false },
    quantity: { type: Number }, // For stock purchases
    date: { type: Date, default: Date.now }
});

// Stock Movement Schema (tracks all stock changes)
const stockMovementSchema = new mongoose.Schema({
    stock_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Stock', required: true },
    type: { type: String, required: true, enum: ['purchase', 'sale', 'adjustment', 'loss'] },
    quantity: { type: Number, required: true }, // positive for additions, negative for subtractions
    reference_type: { type: String }, // 'order', 'expense', 'manual'
    reference_id: { type: mongoose.Schema.Types.ObjectId },
    timestamp: { type: Date, default: Date.now }
});

// Create models
const Product = mongoose.model('Product', productSchema);
const Order = mongoose.model('Order', orderSchema);
const Stock = mongoose.model('Stock', stockSchema);
const Expense = mongoose.model('Expense', expenseSchema);
const StockMovement = mongoose.model('StockMovement', stockMovementSchema);

module.exports = {
    Product,
    Order,
    Stock,
    Expense,
    StockMovement
};