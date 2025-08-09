const {
    default: makeWASocket,
    DisconnectReason,
    jidNormalizedUser,
    useInMemoryAuthState,
    delay
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode');
const pino = require('pino');
const { Writable } = require('stream');

// This map will store the in-memory authentication states for each session
const sessionStateStore = new Map();
// This map will store the active socket connections
const activeSessions = new Map();

// --- Real-time Logger for Frontend ---
const createLoggerForSession = (sessionId, io) => {
    const clientLogStream = new Writable({
        write(chunk, encoding, callback) {
            io.to(sessionId).emit('log', chunk.toString().trim());
            callback();
        }
    });

    return pino({ level: 'info' }, pino.multistream([
        { stream: process.stdout },
        { level: 'trace', stream: clientLogStream }
    ]));
};

// --- Main Session Initialization Logic ---
async function initializeSocket(sessionId, io) {
    if (activeSessions.has(sessionId)) {
        return activeSessions.get(sessionId);
    }

    const logger = createLoggerForSession(sessionId, io);

    // Use Baileys' in-memory auth state
    // This will be lost on server restart, as requested.
    const { state, saveCreds } = await useInMemoryAuthState();
    sessionStateStore.set(sessionId, state);

    const sock = makeWASocket({
        auth: state,
        logger,
        printQRInTerminal: false,
        browser: ['WHIZ LITE', 'Chrome', '4.0'],
    });

    activeSessions.set(sessionId, sock);

    // --- Event Handlers ---
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (connection === 'close') {
            const statusCode = (lastDisconnect.error instanceof Boom) ? lastDisconnect.error.output.statusCode : 0;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            logger.warn(`Connection closed. Reason: ${lastDisconnect.error?.message}. Status: ${statusCode}.`);

            // Since we are not persisting sessions, on close we remove the session.
            // A new one will be created on next request.
            activeSessions.delete(sessionId);
            sessionStateStore.delete(sessionId);
            logger.info(`Session ${sessionId} removed from memory.`);

        } else if (connection === 'open') {
            logger.info('Connection opened successfully.');
            try {
                const rawSessionIdData = JSON.stringify(state.creds);
                const formattedSessionId = `WHIZLITE_${Buffer.from(rawSessionIdData).toString('base64')}`;

                await sock.sendMessage(jidNormalizedUser(sock.user.id), { text: formattedSessionId });
                await delay(1000);
                const confirmationMessage = {
                     text: `╭──❍ *ᴡʜɪᴢ ʟɪᴛᴇ  ʟɪɴᴋ*\n│\n├ ✅ Status: Your device is now linked successfully!\n├ 🔑 Security: Keep your Session ID safe — NEVER share it.\n├ 🌐 Connected Number: ${sock.user.id.split(':')[0]}\n│\n├ 💡 Next Step: You can now use it to deploy your bot\n├ 📜 Owner github.com/mburuwhiz\n├ 🔗 Support: Always here for you — tap the button below.\n│\n╰─> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴡʜɪᴢ-ᴛᴇᴄʜ ©`,
                     footer: "Your connection is now active 🚀",
                     templateButtons: [{
                         index: 1,
                         urlButton: {
                             displayText: "WHIZ LITE SUPPORT",
                             url: "https://wa.me/254759853229"
                         }
                     }]
                 };
                await sock.sendMessage(jidNormalizedUser(sock.user.id), confirmationMessage);
                logger.info('Sent welcome messages to the user.');

            } catch (err) {
                logger.error({ err }, "Failed to send welcome messages.");
            }
        }
    });

    return sock;
}

// --- Exported Functions for Routes ---

async function startSessionWithQR(sessionId, io) {
    const sock = await initializeSocket(sessionId, io);
    const logger = sock.logger;

    return new Promise((resolve, reject) => {
        const qrListener = (update) => {
            if (update.qr) {
                logger.info('QR code generated.');
                qrcode.toDataURL(update.qr)
                    .then(qrImage => resolve({ sessionId, qrCode: qrImage }))
                    .catch(err => reject(err));
                sock.ev.off('connection.update', qrListener);
            }
        };

        sock.ev.on('connection.update', qrListener);
    });
}

async function startSessionWithPairingCode(sessionId, phoneNumber, io) {
    const sock = await initializeSocket(sessionId, io);
    const logger = sock.logger;

    try {
        logger.info(`Requesting pairing code for phone number: ${phoneNumber}`);
        const cleanedPhoneNumber = phoneNumber.replace(/[^0-9]/g, '');
        if (!cleanedPhoneNumber) {
            throw new Error("Invalid phone number format.");
        }
        const pairingCode = await sock.requestPairingCode(cleanedPhoneNumber);
        logger.info(`Pairing code generated: ${pairingCode}`);
        return { sessionId, pairingCode };
    } catch (error) {
        logger.error({ error }, "Failed to request pairing code.");
        throw new Error("Could not request pairing code. Is the phone number valid?");
    }
}

function getSessionStatus(sessionId) {
    const sock = activeSessions.get(sessionId);
    if (!sock) return { status: 'disconnected', message: 'Session not found.' };
    return { status: 'pending', message: 'Session is active, check logs for connection status.' };
}

module.exports = { startSessionWithQR, startSessionWithPairingCode, getSessionStatus };
