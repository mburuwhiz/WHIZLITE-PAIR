const express = require('express');
const router = express.Router();
const whatsappService = require('../services/whatsappService');

/**
 * @route   POST /api/sessions/start
 * @desc    Start a new WhatsApp session and get a QR code
 * @access  Public
 */
router.post('/start', async (req, res) => {
    try {
        // Generate a unique session ID for this request.
        // In a real-world multi-tenant app, you might receive this from the client
        // or generate it based on authenticated user information.
        const sessionId = `session_${Date.now()}`;

        // Start the session, which will return a promise that resolves with the QR code
        const result = await whatsappService.startNewSession(sessionId);

        if (result.error) {
            return res.status(409).json({ error: result.error }); // 409 Conflict if session exists
        }

        res.status(200).json({
            message: 'Session started. Please scan the QR code.',
            sessionId: result.sessionId,
            qrCode: result.qrCode,
        });

    } catch (error) {
        console.error('Error starting new session:', error);
        res.status(500).json({ error: 'Failed to start a new session.' });
    }
});

/**
 * @route   GET /api/sessions/status/:sessionId
 * @desc    Check the status of a WhatsApp session
 * @access  Public
 */
router.get('/status/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required.' });
    }
    try {
        const status = whatsappService.getSessionStatus(sessionId);
        res.status(200).json(status);
    } catch (error) {
        console.error(`Error getting status for session ${sessionId}:`, error);
        res.status(500).json({ error: 'Failed to get session status.' });
    }
});


module.exports = router;
