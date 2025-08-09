# WHIZ LITE WhatsApp Linker

A scalable, multi-user gateway for a service named WHIZ LITE. This system allows users to securely link their WhatsApp accounts to the WHIZ LITE platform, receive a custom-formatted session ID, and then have their account ready for use with other WHIZ LITE services.

This application provides a user-friendly web interface for linking devices via QR code or a phone number pairing code, and includes a real-time log viewer for monitoring the connection process.

**Important:** This application uses in-memory session storage. All linked sessions will be lost when the server restarts.

## Features

- **Dual Linking Methods:**
    - **QR Code:** The standard, quick method to link a device by scanning a QR code.
    - **Pairing Code:** An alternative method where the user enters their phone number to receive a code to input on their device.
- **Real-time Log Viewer:** A live log panel on the frontend streams detailed connection events directly from the backend for easy monitoring and debugging.
- **In-Memory Sessions:** Sessions are stored temporarily in memory for simplicity. No database is required.
- **Modern UI:** A clean, responsive user interface built with EJS for server-side rendering.
- **Copy-to-Clipboard:** Easily copy the generated pairing code with a single click.

## Tech Stack

- **Backend:** Node.js, Express.js, Socket.IO (for real-time logs)
- **WhatsApp Integration:** `@whiskeysockets/baileys`
- **Frontend:** EJS (Embedded JavaScript templates), CSS3, Vanilla JavaScript

## Setup and Installation

Follow these steps to get the application running on your local machine.

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher recommended)

### 1. Clone the Repository

```bash
git clone <repository-url>
cd whizlite-whatsapp-linker
```

### 2. Install Dependencies

Install all the required npm packages.

```bash
npm install
```

## Running the Application

Once the setup is complete, you can start the server with the following command:

```bash
npm start
```

The server will start, and you will see a confirmation message in your console:
`Server is running on http://localhost:3000`

Now, open your web browser and navigate to `http://localhost:3000` to use the application.
