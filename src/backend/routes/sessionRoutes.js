const express = require('express');
const router = express.Router();
const whatsappService = require('../services/whatsappService');

/**
 * @route   POST /api/sessions/start/qr
 * @desc    Start a new session and get a QR code
 * @access  Public
 */
router.post('/start/qr', async (req, res) => {
    const sessionId = `session_qr_${Date.now()}`;
    const { io } = req;

    try {
        const result = await whatsappService.startSessionWithQR(sessionId, io);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error starting QR session:', error);
        res.status(500).json({ error: 'Failed to start QR session.' });
    }
});

/**
 * @route   POST /api/sessions/start/pair
 * @desc    Start a new session using a pairing code
 * @access  Public
 */
router.post('/start/pair', async (req, res) => {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number is required.' });
    }

    const sessionId = `session_pair_${Date.now()}`;
    const { io } = req;

    try {
        const result = await whatsappService.startSessionWithPairingCode(sessionId, phoneNumber, io);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error starting pairing code session:', error);
        res.status(500).json({ error: error.message || 'Failed to start pairing code session.' });
    }
});

/**
 * @route   GET /api/sessions/status/:sessionId
 * @desc    Check the status of a session
 * @access  Public
 */
router.get('/status/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    try {
        const status = whatsappService.getSessionStatus(sessionId);
        res.status(200).json(status);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get session status.' });
    }
});

module.exports = router;
