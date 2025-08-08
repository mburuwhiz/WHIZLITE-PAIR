Full Prompt for a Multi-User WhatsApp Gateway for Whiz Lite Pairing (ITC)
Based on our conversation, here is a 
Project Name:  WHIZ LITE WhatsApp Linker
Project Goal: To create a scalable, multi-user gateway for a service called Whiz Lite Pairing. This system will allow users to securely link their WhatsApp accounts to the  platform, receive a custom-formatted session ID, and then have their account ready for use with other ITC services.
System Requirements:
 * User Onboarding:
   * A web interface will serve as the entry point for users to link their devices.
   * The system will dynamically generate a unique QR code for each new connection attempt. This QR code will be displayed on the web interface in real-time.
   * A pairing code alternative will also be provided for users who prefer manual linking.
 * Session Management & Delivery:
   * Upon a successful connection via QR or pairing code, the system must immediately perform the following actions:
     * Format the Session ID: The raw session credentials received from the Baileys library must be converted into a single string. This string will then be prepended with WHIZLITE_ to create a custom-formatted session ID.
     * Database Storage: The WHIZLITE_{raw_session_id_data} string must be stored securely in a database, associated with the user's unique identifier.
     * Message 1 (Session ID): The system will send a WhatsApp message to the newly connected phone number containing only the WHIZLITE_ formatted session ID string.
     * Message 2 (Confirmation & Warning): A second, separate WhatsApp message will be sent. This message will contain a success confirmation, a strong warning not to share the session ID, and a clear explanation of what the user can now do with their linked account.
 * Scalability and Architecture:
   * Backend: A Node.js application using Express.js will manage all API requests and handle the Baileys library.
   * Database: A scalable database (e.g., PostgreSQL, MongoDB) is mandatory for storing the session credentials of a large number of users (1,000+). File-based session storage is explicitly forbidden.
   * Parallelism: The backend must be designed to handle multiple concurrent WebSocket connections from WhatsApp and API requests from the frontend without bottlenecks.
 * Technology Stack:
   * Backend: Node.js, Express.js, @whiskeysockets/baileys.
   * Database: Choose a suitable database driver (e.g., mongoose for MongoDB, pg for PostgreSQL).
   * Frontend: A simple, responsive web page using vanilla HTML, CSS, and JavaScript.
   * Utilities: qrcode library for QR code generation, a logger for debugging and monitoring (e.g., winston).
Perfect File Layout and Folder Structure
This structure is designed for clarity, maintainability, and scalability.
/ITC-whatsapp-linker
├── node_modules/
├── .env                      # Environment variables (e.g., DB URI, port)
├── .gitignore
├── package.json              # Dependencies and scripts
│
├── /src/
│   ├── /backend/
│   │   ├── /routes/
│   │   │   ├── sessionRoutes.js  # API endpoints for session management
│   │   │   └── index.js          # Central router
│   │   │
│   │   ├── /services/
│   │   │   ├── whatsappService.js  # Core Baileys integration and messaging logic
│   │   │   └── dbService.js        # Database operations (connect, save, get, delete session)
│   │   │
│   │   ├── server.js         # Express server setup and startup script
│   │   └── utils.js          # Shared utility functions (e.g., logging)
│   │
│   └── /frontend/
│       ├── /public/
│       │   ├── index.html    # The main web page with the UI
│       │   ├── style.css     # CSS for styling the UI
│       │   └── app.js        # Client-side JavaScript to fetch QR code and handle events
│       │
│       └── /assets/          # Images, fonts, etc.
│           └── itc_logo.png
│
└── start.js                  # A script to run the server (e.g., `node src/backend/server.js`)

Example Code Snippets
1. src/backend/server.js (Simplified)
const express = require('express');
const sessionRoutes = require('./routes/sessionRoutes');
const { connectToDatabase } = require('./services/dbService');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('src/frontend/public'));

// Connect to the database before starting the server
connectToDatabase().then(() => {
    console.log('Database connected successfully.');
    app.use('/api/sessions', sessionRoutes);
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Failed to connect to the database:', err);
    process.exit(1);
});

2. src/backend/routes/sessionRoutes.js (Simplified)
const express = require('express');
const router = express.Router();
const whatsappService = require('../services/whatsappService');

router.post('/start', async (req, res) => {
    try {
        const { sessionId, qrCode } = await whatsappService.startNewSession();
        res.status(200).json({ sessionId, qrCode });
    } catch (error) {
        console.error('Error starting new session:', error);
        res.status(500).json({ error: 'Failed to start a new session.' });
    }
});

module.exports = router;

3. src/backend/services/whatsappService.js (Key Logic Snippet)
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode');
const dbService = require('./dbService');

async function startNewSession(sessionId) {
    // Note: This is a placeholder for your database-driven session state.
    // The `useMultiFileAuthState` will need to be replaced with your custom db logic.
    const { state, saveCreds } = await useMultiFileAuthState(`sessions/${sessionId}`);
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
    });

    return new Promise(async (resolve, reject) => {
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr, isNewLogin } = update;

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect.error instanceof Boom) && lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) {
                    await startNewSession(sessionId);
                } else {
                    reject(new Error('Connection closed and not reconnecting.'));
                }
            }
            
            if (qr) {
                const qrImage = await qrcode.toDataURL(qr);
                resolve({ sessionId, qrCode: qrImage });
            }

            if (connection === 'open' && isNewLogin) {
                // Here is the custom session ID logic
                const rawSessionIdData = JSON.stringify(state.creds);
                const formattedSessionId = `WHIZLITE_${rawSessionIdData}`;
                
                // Save to database (this is a conceptual call)
                await dbService.saveSession(sessionId, formattedSessionId);

                // Send the two separate messages
                await sock.sendMessage(sock.user.id, { text: `Your unique session ID is:\n\n${formattedSessionId}` });
                await sock.sendMessage(sock.user.id, { text: 'This confirms your device is linked. Do not share your session ID. You can now use ITC services.' });
            }
        });

        sock.ev.on('creds.update', saveCreds);
    });
}

module.exports = { startNewSession };

This comprehensive plan provides you with all the details, from the high-level prompt to the specific file layout and core code logic, to successfully build your multi-user ITC WhatsApp gateway.


connection success / second mesage template 

await sock.sendMessage(sock.user.id, {
    text: `╭──❍ *ᴡʜɪᴢ ʟɪᴛᴇ ɪᴛᴄ ʟɪɴᴋᴇʀ*
│
├ ✅ *Status:* Your device is now linked successfully!
├ 🔑 *Security:* Keep your Session ID safe — NEVER share it.
├ 🌐 *Connected Number:* ${sock.user.id.split(':')[0]}
│
├ 💡 *Next Step:* You can now use all ITC WHIZ LITE services.
├ 📜 *Tip:* Type *.menu* to see the full command list.
├ 🔗 *Support:* Always here for you — tap the button below.
│
╰─> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴡʜɪᴢ-ᴛᴇᴄʜ ©*`,
    footer: "Your connection is now active 🚀",
    templateButtons: [
        {
            index: 1,
            urlButton: {
                displayText: "WHIZ LITE SUPPORT",
                url: "https://whiztechsupport.example" // replace with your real support site
            }
        }
    ]
});

