const express = require('express');
const router = express.Router();
const PromoSlide = require('../models/PromoSlide');
const { verifyToken, checkRole } = require('../middleware/auth');

// @route   GET api/promos
// @desc    Get all promo slides
// @access  Admin
router.get('/', verifyToken, checkRole(['admin']), async (req, res) => {
    try {
        const slides = await PromoSlide.find();
        res.json(slides);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/promos
// @desc    Create a promo slide
// @access  Admin
router.post('/', verifyToken, checkRole(['admin']), async (req, res) => {
    const { title, description, image, active, expiryDate } = req.body;

    try {
        const newSlide = new PromoSlide({
            title,
            description,
            image,
            active,
            expiryDate
        });

        const slide = await newSlide.save();
        res.json(slide);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT api/promos/:id
// @desc    Update a promo slide
// @access  Admin
router.put('/:id', verifyToken, checkRole(['admin']), async (req, res) => {
    const { title, description, image, active, expiryDate } = req.body;

    // Build slide object
    const slideFields = {};
    if (title) slideFields.title = title;
    if (description) slideFields.description = description;
    if (image) slideFields.image = image;
    if (active !== undefined) slideFields.active = active;
    if (expiryDate) slideFields.expiryDate = expiryDate;

    try {
        let slide = await PromoSlide.findById(req.params.id);

        if (!slide) return res.status(404).json({ msg: 'Slide not found' });

        slide = await PromoSlide.findByIdAndUpdate(
            req.params.id,
            { $set: slideFields },
            { new: true }
        );

        res.json(slide);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE api/promos/:id
// @desc    Delete a promo slide
// @access  Admin
router.delete('/:id', verifyToken, checkRole(['admin']), async (req, res) => {
    try {
        let slide = await PromoSlide.findById(req.params.id);

        if (!slide) return res.status(404).json({ msg: 'Slide not found' });

        await PromoSlide.findByIdAndRemove(req.params.id);

        res.json({ msg: 'Slide removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
