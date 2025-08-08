document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('start-button');
    const statusMessage = document.getElementById('status-message');
    const qrImage = document.getElementById('qr-image');
    const loader = document.getElementById('loader');

    let sessionId = null;
    let pollingInterval = null;

    const resetUI = () => {
        qrImage.style.display = 'none';
        qrImage.src = '';
        loader.style.display = 'none';
        startButton.disabled = false;
        startButton.textContent = 'Generate New QR Code';
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    };

    const pollStatus = async () => {
        if (!sessionId) return;

        try {
            const response = await fetch(`/api/sessions/status/${sessionId}`);
            if (!response.ok) {
                // Stop polling on server error
                throw new Error(`Server error: ${response.statusText}`);
            }
            const data = await response.json();

            if (data.status === 'connected') {
                statusMessage.textContent = 'Device connected successfully! You can close this window.';
                statusMessage.className = 'status-connected';
                resetUI();
            }
        } catch (error) {
            console.error('Polling error:', error);
            statusMessage.textContent = 'Error checking status. Please try again.';
            statusMessage.className = 'status-error';
            resetUI();
        }
    };

    startButton.addEventListener('click', async () => {
        // Reset state from previous attempts
        resetUI();
        qrImage.style.display = 'none';
        loader.style.display = 'block';
        statusMessage.textContent = 'Generating QR code, please wait...';
        statusMessage.className = '';
        startButton.disabled = true;

        try {
            const response = await fetch('/api/sessions/start', { method: 'POST' });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to start session.');
            }

            sessionId = data.sessionId;
            qrImage.src = data.qrCode;
            qrImage.style.display = 'block';
            loader.style.display = 'none';
            statusMessage.textContent = 'Scan the QR code with your WhatsApp.';

            // Start polling for connection status
            pollingInterval = setInterval(pollStatus, 3000); // Poll every 3 seconds

        } catch (error) {
            console.error('Error:', error);
            statusMessage.textContent = `Error: ${error.message}`;
            statusMessage.className = 'status-error';
            resetUI();
        }
    });
});
