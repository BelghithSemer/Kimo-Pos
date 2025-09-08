const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// MongoDB connection with retry logic
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/simplepos', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected successfully');
        
        // Load User model after DB connection to create default admin
        require('./models/User');
    } catch (err) {
        console.error('MongoDB connection error:', err);
        // Retry connection after 5 seconds
        setTimeout(connectDB, 5000);
    }
};

// Connect to database
connectDB();

// Import routes
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const productsRouter = require('./routes/products');
const ordersRouter = require('./routes/orders');
const stockRouter = require('./routes/stock');
const expensesRouter = require('./routes/expenses');
const promosRouter = require('./routes/promos');
const clientRouter = require('./routes/client');
const { verifyToken } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - important for services like Render/Heroku
app.set('trust proxy', 1);

// CORS configuration for production
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://your-app.onrender.com'] // Replace with your actual domain
        : '*',
    credentials: true,
    optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Serve static files
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
// Public routes (no auth required)
app.use('/api/auth', authRouter);
app.use('/api/client', clientRouter);

// Protected routes (auth required)
app.use('/api/users', verifyToken, usersRouter);
app.use('/api/products', verifyToken, productsRouter);
app.use('/api/orders', verifyToken, ordersRouter);
app.use('/api/stock', verifyToken, stockRouter);
app.use('/api/expenses', verifyToken, expensesRouter);
app.use('/api/credits', verifyToken, require('./routes/credits'));
app.use('/api/promos', verifyToken, promosRouter);

// Add this to your existing routes
app.get('/credits', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/credits.html'));
});
// Middleware to log authentication issues (for debugging)
app.use('/api/', (req, res, next) => {
    if (req.path.startsWith('/api/orders/tables')) {
        console.log(`Request to ${req.path} with headers:`, req.headers);
    }
    next();
});

// Health check endpoint for monitoring
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// Serve frontend pages
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/backoffice', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/backoffice.html'));
});

app.get('/orders', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/orders.html'));
});

app.get('/stock', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/stock.html'));
});

app.get('/expenses', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/expenses.html'));
});

app.get('/users', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/users.html'));
});

// Catch-all route - must be last
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Promise Rejection:', err);
    // Don't exit the process in production
    if (process.env.NODE_ENV !== 'production') {
        process.exit(1);
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        mongoose.connection.close(false, () => {
            console.log('MongoDB connection closed');
            process.exit(0);
        });
    });
});

// Start server
const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    if (process.env.NODE_ENV !== 'production') {
        console.log(`Local: http://localhost:${PORT}`);
    }
});

module.exports = app;