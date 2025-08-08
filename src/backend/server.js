const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const sessionRoutes = require('./routes/sessionRoutes');
const { connectToDatabase } = require('./services/dbService');

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Serve frontend static files
const frontendPath = path.join(__dirname, '..', 'frontend', 'public');
app.use(express.static(frontendPath));

// API Routes
app.use('/api/sessions', sessionRoutes);

// A simple root route to serve the index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// Connect to the database and then start the server
console.log('Connecting to the database...');
connectToDatabase()
    .then(() => {
        console.log('Database connection successful.');
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
            console.log('Open the URL in your browser to link your WhatsApp account.');
        });
    })
    .catch(err => {
        console.error('Failed to connect to the database. Server will not start.', err);
        process.exit(1);
    });
