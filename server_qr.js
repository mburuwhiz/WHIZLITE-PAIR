require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const qrcode = require('qrcode');
const crypto = require('crypto');
const { default: makeWASocket, DisconnectReason, Browsers, initAuthCreds } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const logger = pino({ transport: { target: 'pino-pretty' } });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

const liveSessions = new Map();
const sessionAuthStates = new Map();

function initInMemoryAuthStore() {
    const creds = initAuthCreds();
    const keys = new Map();
    const get = (type, ids) => {
        const data = {};
        for (const id of ids) {
            const value = keys.get(`${type}-${id}`);
            if (value) data[id] = value;
        }
        return data;
    };
    const set = (data) => {
        for (const key in data) {
            for (const id in data[key]) {
                const value = data[key][id];
                const keyId = `${key}-${id}`;
                if (value) keys.set(keyId, value);
                else keys.delete(keyId);
            }
        }
    };
    return { state: { creds, keys: { get, set } }, saveCreds: () => {} };
}

// --- THIS FUNCTION CONTAINS THE FIX ---
function startSession(sessionId, io) {
    logger.info(`Initializing QR session: ${sessionId}`);
    
    // --- CHANGE 1: Get existing auth state from map, or create a new one ---
    const auth = sessionAuthStates.get(sessionId) || initInMemoryAuthStore();
    sessionAuthStates.set(sessionId, auth); // Ensure it's in the map for future restarts

    const sock = makeWASocket({ auth: auth.state, printQRInTerminal: false, browser: Browsers.macOS('Desktop'), logger, shouldSyncHistoryMessage: () => false });
    liveSessions.set(sessionId, sock);

    // --- CHANGE 2: Make sure we save any credential updates ---
    sock.ev.on('creds.update', auth.saveCreds);
    
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        const clientRoom = io.to(sessionId);

        if (qr) {
            clientRoom.emit('qr', await qrcode.toDataURL(qr));
        }
        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
            liveSessions.delete(sessionId);
            if (reason === DisconnectReason.restartRequired) {
                logger.info(`Restart required for QR session ${sessionId}, re-initializing...`);
                // Now when we restart, the auth state will be preserved
                startSession(sessionId, io);
            } else {
                sessionAuthStates.delete(sessionId);
                clientRoom.emit('status', { message: 'Connection Closed. Please refresh.' });
            }
        } else if (connection === 'open') {
            clientRoom.emit('status', { message: 'Device connected! Sending Session ID...' });
            try {
                const rawSessionData = JSON.stringify(auth.state.creds);
                const formattedSessionId = `WHIZLITE_${Buffer.from(rawSessionData).toString('base64')}`;
                await sock.sendMessage(sock.user.id, { text: formattedSessionId });
                await sock.sendMessage(sock.user.id, { text: `╭──❍ *ᴡʜɪᴢ ʟɪᴛᴇ  ʟɪɴᴋ*\n│\n├ ✅ Status: Your device is now linked and LIVE!\n│\n╰─> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴡʜɪᴢ-ᴛᴇᴄʜ ©*` });
                clientRoom.emit('status', { message: `✅ Success! Session is live.` });
            } catch (err) {
                logger.error(err, "Error during session sending.");
                clientRoom.emit('status', { message: 'Error sending session.' });
            }
        }
    });
}

app.get('/', (req, res) => {
    const sessionId = crypto.randomUUID();
    startSession(sessionId, io);
    res.render('qr', { sessionId });
});

io.on('connection', (socket) => {
    logger.info(`Client connected to QR Server: ${socket.id}`);
    socket.on('join-room', (sessionId) => socket.join(sessionId));
});

server.listen(PORT, () => logger.info(`QR Linker is running on http://localhost:${PORT}`));