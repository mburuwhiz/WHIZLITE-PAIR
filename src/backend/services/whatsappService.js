const {
    default: makeWASocket,
    DisconnectReason,
    jidNormalizedUser,
    useInMemoryAuthState, // We will use this as a base and adapt it
    delay
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode');
const pino = require('pino');
const { Writable } = require('stream');
const dbService = require('./dbService');

const sessions = new Map();

// --- Robust Session Store using Database ---
const useDatabaseAuthState = async (sessionId, logger) => {
    let state = { creds: {}, keys: {} }; // Default empty state

    const sessionFromDB = await dbService.getSession(sessionId);
    if (sessionFromDB && sessionFromDB.sessionData) {
        // The sessionData from DB is a complete auth state object
        state = sessionFromDB.sessionData;
        logger.info('Successfully loaded auth state from DB');
    }

    const writeData = async (data, id) => {
        // This function is not directly used by Baileys, but by our saveCreds logic
        // It's a placeholder for a more complex key-value store if we were to split the state
        // For now, we save the whole state object together.
    };

    const readData = async (id) => {
        // Placeholder, not used as we load all at once.
        return null;
    };

    const removeData = async (id) => {
        // Placeholder for removing specific keys, not used.
    };

    const saveState = async () => {
        logger.info('Saving auth state to DB...');
        try {
            await dbService.saveSession(sessionId, state);
            logger.info('Successfully saved auth state.');
        } catch (error) {
            logger.error({ error }, 'Failed to save auth state to DB.');
        }
    };

    // We will wrap the state object to trigger saveState on any changes
    const stateProxy = new Proxy(state, {
        set(target, prop, value) {
            target[prop] = value;
            // Schedule a save, debouncing could be added here for performance
            saveState();
            return true;
        }
    });

    return {
        state: stateProxy,
        saveState, // We can call this manually if needed
        // The following functions are for compatibility with Baileys' multi-file auth state structure,
        // but our implementation centralizes saving through the proxy.
        clear: () => {
            state = { creds: {}, keys: {} };
        }
    };
};

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
    if (sessions.has(sessionId)) {
        return sessions.get(sessionId);
    }

    const logger = createLoggerForSession(sessionId, io);
    const { state, saveState } = await useDatabaseAuthState(sessionId, logger);

    const sock = makeWASocket({
        auth: state,
        logger,
        printQRInTerminal: false,
        browser: ['WHIZ LITE', 'Chrome', '3.0'],
    });

    sessions.set(sessionId, sock);

    // --- Event Handlers ---
    sock.ev.on('creds.update', saveState);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const statusCode = (lastDisconnect.error instanceof Boom) ? lastDisconnect.error.output.statusCode : 0;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            logger.warn(`Connection closed. Reason: ${lastDisconnect.error?.message}. Status: ${statusCode}. Reconnecting: ${shouldReconnect}`);

            if (shouldReconnect) {
                // This might be a temporary issue, let Baileys handle the reconnection.
            } else {
                logger.error('Connection closed permanently. Removing session.');
                await dbService.deleteSession(sessionId);
                sessions.delete(sessionId);
            }
        } else if (connection === 'open') {
            logger.info('Connection opened successfully.');
            try {
                // Check if we have already sent the welcome message
                const sessionDoc = await dbService.getSession(sessionId);
                if (!sessionDoc.sessionData.sentWelcomeMessage) {
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

                    // Mark that we've sent the message
                    state.sentWelcomeMessage = true;
                    await saveState();
                }
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
                    .catch(err => {
                        logger.error({ err }, 'Failed to convert QR to data URL');
                        reject(err);
                    });
                // Clean up the listener
                sock.ev.off('connection.update', qrListener);
            }
             if(update.connection === 'open') {
                logger.info('Connection opened before QR was scanned (reconnection).');
                resolve({ sessionId, qrCode: null, message: 'Device already connected.' });
                sock.ev.off('connection.update', qrListener);
            }
        };

        sock.ev.on('connection.update', qrListener);

        // Handle case where QR is already available on initial socket creation
        if (sock.qr) {
            logger.info('QR code was already available.');
            qrcode.toDataURL(sock.qr)
                .then(qrImage => resolve({ sessionId, qrCode: qrImage }))
                .catch(err => reject(err));
            sock.ev.off('connection.update', qrListener);
        }
    });
}

async function startSessionWithPairingCode(sessionId, phoneNumber, io) {
    const sock = await initializeSocket(sessionId, io);
    const logger = sock.logger;

    if (!sock.user) {
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
            throw new Error("Could not request pairing code. Is the phone number valid and not already linked?");
        }
    } else {
        logger.warn("A user is already logged in for this session.");
        throw new Error("User already logged in.");
    }
}

function getSessionStatus(sessionId) {
    const sock = sessions.get(sessionId);
    if (!sock) return { status: 'disconnected', message: 'Session not found.' };
    return { status: 'pending', message: 'Session is active, check logs for connection status.' };
}

module.exports = { startSessionWithQR, startSessionWithPairingCode, getSessionStatus };
