const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Get all users (admin only)
router.get('/', verifyToken, isAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Create new user (admin only)
router.post('/', verifyToken, isAdmin, async (req, res) => {
    try {
        const { email, password, name, role } = req.body;
        
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        
        const user = new User({
            email,
            password,
            name,
            role: role || 'cashier'
        });
        
        await user.save();
        
        res.json({
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.role
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Update user (admin only)
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const { name, email, isActive, role } = req.body;
        
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { name, email, isActive, role },
            { new: true }
        ).select('-password');
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Delete user (admin only)
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        // Prevent deleting the default admin
        const user = await User.findById(req.params.id);
        if (user.email === 'boty@gmail.com') {
            return res.status(400).json({ error: 'Cannot delete default admin' });
        }
        
        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Get user activity (admin only)
router.get('/activity', verifyToken, isAdmin, async (req, res) => {
    try {
        const users = await User.find({ lastLogin: { $exists: true } })
            .select('name email lastLogin role')
            .sort({ lastLogin: -1 })
            .limit(20);
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch activity' });
    }
});

module.exports = router;