// Load environment variables MUST be the first thing
const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { connectToDatabase } = require('./services/dbService');
const sessionRoutes = require('./routes/sessionRoutes'); // This will be the new API routes
const viewRoutes = require('./routes/viewRoutes'); // This will be the new view rendering routes

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// View engine setup
app.set('views', path.join(__dirname, '..', 'frontend', 'views'));
app.set('view engine', 'ejs');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));

// Pass socket.io to each request
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Routes
app.use('/', viewRoutes);
app.use('/api/sessions', sessionRoutes);


// Socket.io connection logic
io.on('connection', (socket) => {
    console.log(`A user connected via WebSocket: ${socket.id}`);

    // When a client wants to receive logs for a session, it must join a room.
    socket.on('join_room', (sessionId) => {
        if (sessionId) {
            socket.join(sessionId);
            console.log(`Socket ${socket.id} joined room: ${sessionId}`);
            // You can optionally send a confirmation message back to the client
            socket.emit('log', 'Successfully joined session room. Awaiting logs...');
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = { io }; // Export io for other modules if needed
