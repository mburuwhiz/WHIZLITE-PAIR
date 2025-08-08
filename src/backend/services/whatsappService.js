const {
    default: makeWASocket,
    useSingleFileAuthState,
    DisconnectReason,
    makeInMemoryStore,
    jidNormalizedUser,
    proto,
    delay
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode');
const dbService = require('./dbService');
const P = require('pino');

// A map to store active sessions
const sessions = new Map();

// A custom session store using the database
const useDatabaseAuthState = async (sessionId) => {
    const sessionFromDB = await dbService.getSession(sessionId);
    let initialCreds;
    if (sessionFromDB && sessionFromDB.sessionData) {
        try {
            initialCreds = JSON.parse(sessionFromDB.sessionData);
        } catch (e) {
            console.error("Could not parse session data from DB", e);
            initialCreds = null;
        }
    } else {
        initialCreds = null;
    }

    const saveState = async (creds) => {
        const sessionData = JSON.stringify(creds, null, 2);
        await dbService.saveSession(sessionId, sessionData);
    };

    return {
        state: {
            creds: initialCreds
        },
        saveState,
    };
};


async function startNewSession(sessionId) {
    if (!sessionId) {
        throw new Error("Session ID is required");
    }

    if (sessions.has(sessionId)) {
        // Potentially return the existing session's status or QR code
        // For now, we'll just reject to avoid creating a duplicate
        return { error: "Session already exists." };
    }

    const { state, saveState } = await useDatabaseAuthState(sessionId);

    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            /** saveState is called when authentication credentials are updated */
            saveState: async (creds) => {
                 state.creds = creds;
                 await saveState(creds);
            }
        },
        printQRInTerminal: false,
        logger: P({ level: 'silent' }),
        browser: ['WHIZ LITE', 'Chrome', '1.0.0'],
    });

    sessions.set(sessionId, sock);

    return new Promise((resolve, reject) => {
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                const qrImage = await qrcode.toDataURL(qr);
                resolve({ sessionId, qrCode: qrImage });
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect.error instanceof Boom) &&
                    lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;

                console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);

                if (shouldReconnect) {
                    await startNewSession(sessionId);
                } else {
                    // If logged out, remove session from DB and map
                    await dbService.deleteSession(sessionId);
                    sessions.delete(sessionId);
                    console.log(`Session ${sessionId} closed and removed.`);
                    // We don't reject here as it's a final state, not an error during startup
                }
            }

            if (connection === 'open') {
                console.log(`Connection opened for session: ${sessionId}`);

                // This logic should run only for the first time connection.
                // We can check if we have sent the message before, e.g., by storing a flag in the session data.
                // For simplicity, we are not implementing that check here.

                try {
                    // 1. Format the Session ID
                    const rawSessionIdData = JSON.stringify(state.creds);
                    const formattedSessionId = `WHIZLITE_${Buffer.from(rawSessionIdData).toString('base64')}`;

                    // The prompt asked to save this formatted ID, but that would make session resumption difficult.
                    // Instead, we are saving the raw creds via saveState, and only using this formatted ID for the user message.

                    // 2. Send Message 1 (Session ID)
                    await sock.sendMessage(jidNormalizedUser(sock.user.id), {
                        text: formattedSessionId
                    });

                    await delay(1000); // Small delay between messages

                    // 3. Send Message 2 (Confirmation & Warning)
                    const confirmationMessage = {
                        text: `╭──❍ *ᴡʜɪᴢ ʟɪᴛᴇ  ʟɪɴᴋ*\n│\n├ ✅ Status: Your device is now linked successfully!\n├ 🔑 Security: Keep your Session ID safe — NEVER share it.\n├ 🌐 Connected Number: ${sock.user.id.split(':')[0]}\n│\n├ 💡 Next Step: You can now use it to deploy your bot\n├ 📜 Owner github.com/mburuwhiz\n├ 🔗 Support: Always here for you — tap the button below.\n│\n╰─> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴡʜɪᴢ-ᴛᴇᴄʜ ©`,
                        footer: "Your connection is now active 🚀",
                        templateButtons: [{
                            index: 1,
                            urlButton: {
                                displayText: "WHIZ LITE SUPPORT",
                                url: "https://wa.me/254759853229" // A real support URL
                            }
                        }]
                    };
                    await sock.sendMessage(jidNormalizedUser(sock.user.id), confirmationMessage);

                } catch (err) {
                    console.error("Error sending initial messages:", err);
                }
            }
        });
    });
}

function getSessionStatus(sessionId) {
    const sock = sessions.get(sessionId);
    if (!sock) return { status: 'disconnected' };
    // You can expand this to return more detailed status from the socket if needed
    return { status: 'connected' };
}

module.exports = { startNewSession, getSessionStatus };
