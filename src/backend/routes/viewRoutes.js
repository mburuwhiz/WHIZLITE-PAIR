const express = require('express');
const router = express.Router();

// Route to render the homepage
router.get('/', (req, res) => {
    res.render('index', { title: 'WHIZ LITE Linker' });
});

// Route to render the QR code page
router.get('/qr', (req, res) => {
    res.render('qr', { title: 'Link with QR Code' });
});

// Route to render the pairing code page
router.get('/pair', (req, res) => {
    res.render('pair', { title: 'Link with Pairing Code' });
});


module.exports = router;
