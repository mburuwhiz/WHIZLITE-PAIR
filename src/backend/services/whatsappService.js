const {
    default: makeWASocket,
    DisconnectReason,
    jidNormalizedUser,
    delay
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode');
const pino = require('pino');
const { Writable } = require('stream');
const dbService = require('./dbService');

const sessions = new Map();

// --- Custom Session Store using Database ---
const useDatabaseAuthState = async (sessionId) => {
    const sessionFromDB = await dbService.getSession(sessionId);
    let creds;
    const keys = {};

    try {
        const parsedData = JSON.parse(sessionFromDB?.sessionData || '{}');
        creds = parsedData.creds || {};
        // Note: For a full-featured auth state, you would need to hydrate all the keys.
        // This simplified version focuses on `creds`.
    } catch (e) {
        console.error("Could not parse session data from DB", e);
        creds = {};
    }

    const saveCreds = async (newCreds) => {
        // This function is called by Baileys when creds are updated.
        const sessionData = JSON.stringify({ creds: newCreds }, null, 2);
        await dbService.saveSession(sessionId, sessionData);
    };

    return {
        state: { creds, keys },
        saveCreds,
    };
};

// --- Real-time Logger for Frontend ---
const createLoggerForSession = (sessionId, io) => {
    const clientLogStream = new Writable({
        write(chunk, encoding, callback) {
            // Emit log to the specific client's room
            io.to(sessionId).emit('log', chunk.toString().trim());
            callback();
        }
    });

    return pino({ level: 'info' }, pino.multistream([
        { stream: process.stdout }, // Log to server console
        { level: 'trace', stream: clientLogStream } // Send detailed logs to client
    ]));
};

// --- Main Session Initialization Logic ---
async function initializeSocket(sessionId, io) {
    if (sessions.has(sessionId)) {
        return sessions.get(sessionId);
    }

    const logger = createLoggerForSession(sessionId, io);
    const { state, saveCreds } = await useDatabaseAuthState(sessionId);

    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            saveCreds: async (newCreds) => {
                state.creds = newCreds;
                await saveCreds(newCreds);
            }
        },
        logger,
        printQRInTerminal: false,
        browser: ['WHIZ LITE', 'Chrome', '2.0'],
    });

    sessions.set(sessionId, sock);

    // --- Event Handlers ---
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom) &&
                lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;

            logger.warn(`Connection closed. Reason: ${lastDisconnect.error?.message}. Reconnecting: ${shouldReconnect}`);

            if (shouldReconnect) {
                await initializeSocket(sessionId, io);
            } else {
                logger.error('Connection closed permanently. Removing session.');
                await dbService.deleteSession(sessionId);
                sessions.delete(sessionId);
            }
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

    return new Promise((resolve, reject) => {
        // Check if QR is already available
        if (sock.qr) {
            qrcode.toDataURL(sock.qr).then(qrImage => resolve({ sessionId, qrCode: qrImage }));
            return;
        }

        // Listen for the QR event
        sock.ev.once('connection.update', async (update) => {
            if (update.qr) {
                const qrImage = await qrcode.toDataURL(update.qr);
                resolve({ sessionId, qrCode: qrImage });
            }
        });
    });
}

async function startSessionWithPairingCode(sessionId, phoneNumber, io) {
    const sock = await initializeSocket(sessionId, io);
    const logger = sock.logger;

    if (!sock.user) {
        try {
            logger.info(`Requesting pairing code for phone number: ${phoneNumber}`);
            // Sanitize phone number
            const cleanedPhoneNumber = phoneNumber.replace(/[^0-9]/g, '');
            const pairingCode = await sock.requestPairingCode(cleanedPhoneNumber);
            logger.info(`Pairing code generated: ${pairingCode}`);
            return { sessionId, pairingCode };
        } catch (error) {
            logger.error({ error }, "Failed to request pairing code.");
            throw new Error("Could not request pairing code. Is the phone number valid?");
        }
    } else {
        logger.warn("A user is already logged in for this session.");
        throw new Error("User already logged in.");
    }
}


function getSessionStatus(sessionId) {
    const sock = sessions.get(sessionId);
    if (!sock) return { status: 'disconnected', message: 'Session not found.' };

    // This is a simplified status. You can expand it based on sock.ws.readyState or other properties.
    return { status: 'pending', message: 'Session is active, check logs for connection status.' };
}


module.exports = { startSessionWithQR, startSessionWithPairingCode, getSessionStatus };
