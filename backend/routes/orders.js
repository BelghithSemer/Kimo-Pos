const express = require('express');
const router = express.Router();
const { Order, Product, Stock, StockMovement, Table } = require('../database/db');
const { Parser } = require('json2csv');
const { verifyToken, checkRole } = require('../middleware/auth');

// @route   PATCH /api/orders/:id/confirm
// @desc    Confirm a pending order (cashier action)
// @access  Cashier/Admin
router.patch('/:id/confirm', verifyToken, checkRole(['cashier', 'admin']), async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ msg: 'Order not found' });
        }

        if (order.status !== 'pending') {
            return res.status(400).json({ msg: `Order cannot be confirmed because its status is '${order.status}'` });
        }

        // Update order status
        order.status = 'confirmed';
        await order.save();

        // If it's a dine-in order, update the table status
        if (order.table_id) {
            await Table.findByIdAndUpdate(order.table_id, {
                status: 'occupied',
                current_order: order._id
            });
        }

        res.json(order);
    } catch (err) {
        console.error('Error in PATCH /orders/:id/confirm:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get current unpaid order for a specific table
router.get('/table/:tableId', async (req, res) => {
  try {
    const table = await Table.findById(req.params.tableId).populate('current_order');
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    if (!table.current_order) {
      return res.json(null); // Return null if no current order
    }

    // Fetch the full order details
    const order = await Order.findById(table.current_order).lean();
    res.json(order);
  } catch (err) {
    console.error('Error in GET /orders/table/:tableId:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create new order
router.post('/', async (req, res) => {
  try {
    const { items, table_id, order_type } = req.body;
    const orderNumber = 'ORD-' + Date.now();
    
    let total = 0;
    let baseTotal = 0;
    
    // Calculate totals (skip revenue for employee orders)
    items.forEach(item => {
      total += order_type === 'employee' ? 0 : item.price * (item.quantity || 1);
      baseTotal += (item.base_price || 0) * (item.quantity || 1);
    });
    
    // Create order
    const order = new Order({
      order_number: orderNumber,
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
      base_total: baseTotal
    });
    
    await order.save();
    
    // Update table status if dine-in
    if (order_type === 'dine-in' && table_id) {
      await Table.findByIdAndUpdate(table_id, {
        status: 'occupied',
        current_order: order._id
      });
    }
    
    // Update stock for each item (for all order types)
    for (const item of items) {
      const product = await Product.findById(item.id).populate('stock_items.stock_id');
      if (product && product.stock_items) {
        for (const stockItem of product.stock_items) {
          if (stockItem.stock_id && stockItem.quantity_per_unit > 0) {
            const stock = await Stock.findById(stockItem.stock_id);
            if (stock) {
              // Decrease stock based on quantity
              const decrement = stockItem.quantity_per_unit * (item.quantity || 1);
              stock.current_quantity -= decrement;
              stock.last_updated = Date.now();
              await stock.save();
              
              // Record movement
              const movement = new StockMovement({
                stock_id: stock._id,
                type: 'sale',
                quantity: -decrement,
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
      status: order.status,
      order_type: order.order_type,
      table_id: order.table_id
    });
  } catch (err) {
    console.error('Error in POST /orders:', err);
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
    console.error('Error in GET /orders/today:', err);
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
    console.error('Error in GET /orders/date/:date:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all tables - MOVED BEFORE /:id to take precedence
router.get('/tables', async (req, res) => {
  try {
    console.log('Fetching tables from database...');
    const tables = await Table.find();
    console.log(`Found ${tables.length} tables.`);
    res.json(tables);
  } catch (err) {
    console.error('Error in GET /orders/tables:', err);
    res.status(500).json({ error: 'Failed to fetch tables', details: err.message });
  }
});

// Get order details - MOVED AFTER /tables to avoid conflict
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (err) {
    console.error('Error in GET /orders/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update order status - UPDATED TO FREE TABLE WHEN PAID
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

    // If status changed to 'paid', free up the table
    if (status === 'paid' && order.table_id) {
      await Table.findByIdAndUpdate(order.table_id, {
        status: 'free',
        current_order: null
      });
    }

    res.json(order);
  } catch (err) {
    console.error('Error in PUT /orders/:id/status:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update order items (add/remove items or update quantity)
router.put('/:id/items', async (req, res) => {
  try {
    const { items } = req.body; // New list of items to replace existing
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Revert stock changes for old items
    for (const oldItem of order.items) {
      const product = await Product.findById(oldItem.product_id).populate('stock_items.stock_id');
      if (product && product.stock_items) {
        for (const stockItem of product.stock_items) {
          if (stockItem.stock_id && stockItem.quantity_per_unit > 0) {
            const stock = await Stock.findById(stockItem.stock_id);
            if (stock) {
              // Revert stock (add back what was subtracted)
              const increment = stockItem.quantity_per_unit * oldItem.quantity;
              stock.current_quantity += increment;
              stock.last_updated = Date.now();
              await stock.save();
              
              // Record reversal movement
              const movement = new StockMovement({
                stock_id: stock._id,
                type: 'adjustment',
                quantity: increment,
                reference_type: 'order_update',
                reference_id: order._id
              });
              await movement.save();
            }
          }
        }
      }
    }

    // Calculate new totals
    let total = 0;
    let baseTotal = 0;
    items.forEach(item => {
      total += order.order_type === 'employee' ? 0 : (item.price * (item.quantity || 1));
      baseTotal += (item.base_price || 0) * (item.quantity || 1);
    });

    // Update order items
    order.items = items.map(item => ({
      product_id: item.id,
      product_name: item.name,
      price: item.price,
      base_price: item.base_price || 0,
      quantity: item.quantity || 1
    }));
    order.total = total;
    order.base_total = baseTotal;
    await order.save();

    // Apply stock changes for new items
    for (const item of items) {
      const product = await Product.findById(item.id).populate('stock_items.stock_id');
      if (product && product.stock_items) {
        for (const stockItem of product.stock_items) {
          if (stockItem.stock_id && stockItem.quantity_per_unit > 0) {
            const stock = await Stock.findById(stockItem.stock_id);
            if (stock) {
              // Decrease stock based on quantity
              const decrement = stockItem.quantity_per_unit * (item.quantity || 1);
              stock.current_quantity -= decrement;
              stock.last_updated = Date.now();
              await stock.save();
              
              // Record movement
              const movement = new StockMovement({
                stock_id: stock._id,
                type: 'sale',
                quantity: -decrement,
                reference_type: 'order_update',
                reference_id: order._id
              });
              await movement.save();
            }
          }
        }
      }
    }

    res.json(order);
  } catch (err) {
    console.error('Error in PUT /orders/:id/items:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete an order
router.delete('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Revert stock changes
    for (const item of order.items) {
      const product = await Product.findById(item.product_id).populate('stock_items.stock_id');
      if (product && product.stock_items) {
        for (const stockItem of product.stock_items) {
          if (stockItem.stock_id && stockItem.quantity_per_unit > 0) {
            const stock = await Stock.findById(stockItem.stock_id);
            if (stock) {
              // Revert stock (add back what was subtracted)
              const increment = stockItem.quantity_per_unit * item.quantity;
              stock.current_quantity += increment;
              stock.last_updated = Date.now();
              await stock.save();
              
              // Record reversal movement
              const movement = new StockMovement({
                stock_id: stock._id,
                type: 'adjustment',
                quantity: increment,
                reference_type: 'order_delete',
                reference_id: order._id
              });
              await movement.save();
            }
          }
        }
      }
    }

    // Free up table if dine-in
    if (order.table_id) {
      await Table.findByIdAndUpdate(order.table_id, {
        status: 'free',
        current_order: null
      });
    }

    await Order.findByIdAndDelete(order._id);
    res.json({ message: 'Order deleted successfully' });
  } catch (err) {
    console.error('Error in DELETE /orders/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get daily sales summary (updated for order types and expenses)
// Get daily sales summary (updated for order types, expenses, and credit payments)
router.get('/summary/:date', async (req, res) => {
  try {
    const date = new Date(req.params.date);
    date.setHours(0, 0, 0, 0);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    
    const orders = await Order.find({
      timestamp: { $gte: date, $lt: nextDay }
    });

    // Get expenses for the same day
    const { Expense, CreditPayment } = require('../database/db');
    const expenses = await Expense.find({
      date: { $gte: date, $lt: nextDay }
    });

    // Get credit payments for the same day
    const creditPayments = await CreditPayment.find({
      timestamp: { $gte: date, $lt: nextDay }
    });
    
    // Aggregate product sales
    const productSales = {};
    const orderTypeBreakdown = { 'dine-in': 0, 'to-go': 0, 'employee': 0 };
    orders.forEach(order => {
      orderTypeBreakdown[order.order_type]++;
      order.items.forEach(item => {
        if (!productSales[item.product_name]) {
          productSales[item.product_name] = {
            quantity_sold: 0,
            total_revenue: 0,
            total_cost: 0,
            profit: 0
          };
        }
        productSales[item.product_name].quantity_sold += item.quantity;
        productSales[item.product_name].total_revenue += order.order_type === 'employee' ? 0 : (item.price * item.quantity);
        productSales[item.product_name].total_cost += item.base_price * item.quantity;
        productSales[item.product_name].profit += order.order_type === 'employee' ? 0 : ((item.price - item.base_price) * item.quantity);
      });
    });
    
    const products = Object.keys(productSales).map(name => ({
      product_name: name,
      ...productSales[name]
    }));
    
    // Calculate totals including credit payments
    const orderRevenue = orders.reduce((sum, order) => sum + (order.order_type === 'employee' ? 0 : order.total), 0);
    const totalCost = orders.reduce((sum, order) => sum + order.base_total, 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const creditPaymentsTotal = creditPayments.reduce((sum, payment) => sum + payment.amount, 0);
    
    // Total revenue includes both regular orders and credit payments received today
    const totalRevenue = orderRevenue + creditPaymentsTotal;
    const grossProfit = totalRevenue - totalCost;
    const currentCash = totalRevenue - totalExpenses; // Revenue (including credit payments) - Expenses
    
    const totals = {
      total_orders: orders.length,
      order_revenue: orderRevenue, // Revenue from today's orders only
      credit_payments: creditPaymentsTotal, // Credit payments received today
      total_revenue: totalRevenue, // Combined revenue
      total_cost: totalCost,
      total_expenses: totalExpenses,
      gross_profit: grossProfit,
      current_cash: currentCash,
      order_type_breakdown: orderTypeBreakdown
    };
    
    res.json({
      date: req.params.date,
      totals,
      products,
      expenses: expenses.map(expense => ({
        description: expense.description,
        amount: expense.amount,
        category: expense.category,
        date: expense.date
      })),
      credit_payments: creditPayments.map(payment => ({
        amount: payment.amount,
        payment_method: payment.payment_method,
        notes: payment.notes,
        timestamp: payment.timestamp
      }))
    });
  } catch (err) {
    console.error('Error in GET /orders/summary/:date:', err);
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
          status: order.status,
          order_type: order.order_type,
          table_number: order.table_id ? 'Table TBD' : 'N/A'
        });
      });
    });
    
    const fields = ['order_number', 'timestamp', 'product_name', 'price', 'base_price', 'profit', 'status', 'order_type', 'table_number'];
    const json2csv = new Parser({ fields });
    const csv = json2csv.parse(csvData);
    
    res.header('Content-Type', 'text/csv');
    res.attachment(`sales_${startDate}_to_${endDate}.csv`);
    res.send(csv);
  } catch (err) {
    console.error('Error in POST /orders/export:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;