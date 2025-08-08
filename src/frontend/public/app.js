document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // --- Common Elements ---
    const logBox = document.getElementById('log-box');
    const logStatusIndicator = document.getElementById('log-status-indicator');
    let sessionId = null;

    const appendLog = (message) => {
        if (!logBox) return;
        // Sanitize message to prevent HTML injection
        const sanitizedMessage = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        logBox.innerHTML += `${sanitizedMessage}\n`;
        logBox.scrollTop = logBox.scrollHeight;

        // Update status indicator based on logs
        if (sanitizedMessage.includes('Connection opened successfully')) {
            updateLogStatus('Connected', 'connected');
        } else if (sanitizedMessage.includes('Connection closed permanently')) {
            updateLogStatus('Disconnected', 'error');
        }
    };

    const updateLogStatus = (text, statusClass = '') => {
        if (!logStatusIndicator) return;
        logStatusIndicator.textContent = text;
        logStatusIndicator.className = 'log-status'; // Reset classes
        if (statusClass) {
            logStatusIndicator.classList.add(statusClass);
        }
    };

    socket.on('connect', () => {
        console.log('Connected to WebSocket server.');
    });

    socket.on('log', (message) => {
        appendLog(message);
    });

    // --- QR Code Page Logic ---
    if (document.getElementById('qr-linker')) {
        const generateQrBtn = document.getElementById('generate-qr-btn');
        const qrCodeArea = document.getElementById('qr-code-area');
        const loader = document.getElementById('loader');

        generateQrBtn.addEventListener('click', async () => {
            generateQrBtn.disabled = true;
            qrCodeArea.innerHTML = '';
            loader.style.display = 'block';
            updateLogStatus('Generating...', '');

            try {
                const response = await fetch('/api/sessions/start/qr', { method: 'POST' });
                const data = await response.json();

                if (!response.ok) throw new Error(data.error || 'Failed to generate QR code.');

                sessionId = data.sessionId;
                const qrImg = document.createElement('img');
                qrImg.src = data.qrCode;
                loader.style.display = 'none';
                qrCodeArea.appendChild(qrImg);

                updateLogStatus('Waiting for scan...', 'pending');
                socket.emit('join_room', sessionId);

            } catch (error) {
                appendLog(`Error: ${error.message}`);
                updateLogStatus('Error', 'error');
                loader.style.display = 'none';
                generateQrBtn.disabled = false;
            }
        });
    }

    // --- Pairing Code Page Logic ---
    if (document.getElementById('pair-linker')) {
        const phoneForm = document.getElementById('phone-form');
        const generatePairBtn = document.getElementById('generate-pair-btn');
        const phoneInput = document.getElementById('phone-number-input');
        const pairingCodeArea = document.getElementById('pairing-code-area');
        const pairingCodeDisplay = document.getElementById('pairing-code-display');

        phoneForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            generatePairBtn.disabled = true;
            updateLogStatus('Requesting code...', '');

            try {
                const response = await fetch('/api/sessions/start/pair', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phoneNumber: phoneInput.value })
                });
                const data = await response.json();

                if (!response.ok) throw new Error(data.error || 'Failed to get pairing code.');

                sessionId = data.sessionId;
                pairingCodeDisplay.textContent = data.pairingCode.match(/.{1,4}/g).join('-');
                pairingCodeArea.style.display = 'block';

                updateLogStatus('Waiting for link...', 'pending');
                socket.emit('join_room', sessionId);

            } catch (error) {
                appendLog(`Error: ${error.message}`);
                updateLogStatus('Error', 'error');
                generatePairBtn.disabled = false;
            }
        });

        pairingCodeDisplay.addEventListener('click', () => {
            const code = pairingCodeDisplay.textContent.replace(/-/g, '');
            navigator.clipboard.writeText(code).then(() => {
                pairingCodeDisplay.classList.add('copied');
                setTimeout(() => pairingCodeDisplay.classList.remove('copied'), 1500);
            });
        });
    }
});
