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
    category: { type: String, default: 'other', enum: ['coffee', 'drinks', 'other'] }, // NEW FIELD
    image: { type: String },
    stock_items: [{
        stock_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Stock' },
        quantity_per_unit: { type: Number, default: 0 }
    }],
    created_at: { type: Date, default: Date.now }
});

// Order Schema (Updated)
const orderSchema = new mongoose.Schema({
    order_number: { type: String, required: true, unique: true },
    table_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', default: null }, // Link to table if dine-in
    order_type: { type: String, required: true, enum: ['dine-in', 'to-go', 'employee'], default: 'dine-in' }, // Order type
    items: [{
        product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        product_name: String,
        price: Number,
        base_price: Number,
        quantity: { type: Number, default: 1 }
    }],
    total: { type: Number, required: true, default: 0 }, // Revenue total (excluding employee orders)
    base_total: { type: Number, default: 0 }, // Cost total
    status: { type: String, default: 'pending', enum: ['pending', 'confirmed', 'paid', 'unpaid', 'cancelled'] },
    timestamp: { type: Date, default: Date.now }
});

// Table Schema (NEW - THIS WAS MISSING!)
const tableSchema = new mongoose.Schema({
    table_number: { type: Number, required: true, unique: true }, // 1 to 16
    status: { type: String, default: 'free', enum: ['free', 'occupied'] },
    current_order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null }
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

const creditCustomerSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    phone: { type: String },
    address: { type: String },
    total_credit: { type: Number, default: 0 },
    created_at: { type: Date, default: Date.now },
    last_transaction: { type: Date, default: Date.now }
});

// Credit Order Schema
const creditOrderSchema = new mongoose.Schema({
    order_number: { type: String, required: true, unique: true },
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CreditCustomer', required: true },
    customer_name: String,
    items: [{
        product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        product_name: String,
        price: Number,
        base_price: Number,
        quantity: { type: Number, default: 1 }
    }],
    total: { type: Number, required: true, default: 0 },
    base_total: { type: Number, default: 0 },
    amount_paid: { type: Number, default: 0 },
    remaining_balance: { type: Number, required: true },
    status: { type: String, default: 'pending', enum: ['pending', 'partial', 'paid'] },
    table_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', default: null },
    order_type: { type: String, required: true, enum: ['dine-in', 'to-go'], default: 'dine-in' },
    timestamp: { type: Date, default: Date.now }
});

// Credit Payment Schema
const creditPaymentSchema = new mongoose.Schema({
    credit_order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CreditOrder', required: true },
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CreditCustomer', required: true },
    amount: { type: Number, required: true },
    payment_method: { type: String, default: 'cash', enum: ['cash', 'card', 'transfer'] },
    notes: { type: String },
    timestamp: { type: Date, default: Date.now }
});

// Create models
const CreditCustomer = mongoose.model('CreditCustomer', creditCustomerSchema);
const CreditOrder = mongoose.model('CreditOrder', creditOrderSchema);
const CreditPayment = mongoose.model('CreditPayment', creditPaymentSchema);
const Product = mongoose.model('Product', productSchema);
const Order = mongoose.model('Order', orderSchema);
const Stock = mongoose.model('Stock', stockSchema);
const Expense = mongoose.model('Expense', expenseSchema);
const StockMovement = mongoose.model('StockMovement', stockMovementSchema);
const Table = mongoose.model('Table', tableSchema); // THIS WAS MISSING!

// PromoSlide Schema
const promoSlideSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    image: { type: String, required: true },
    active: { type: Boolean, default: true },
    expiryDate: { type: Date }
});

const PromoSlide = mongoose.model('PromoSlide', promoSlideSchema);

module.exports = {
    Product,
    Order,
    Stock,
    Expense,
    StockMovement,
    Table,
    CreditCustomer,
    CreditOrder,
    CreditPayment,
    PromoSlide
};