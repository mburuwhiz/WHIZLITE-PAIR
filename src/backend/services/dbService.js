const mongoose = require('mongoose');

// It's highly recommended to use environment variables for sensitive data like database URIs.
// Since I was unable to create a .env file, this is left as a placeholder.
// In a production environment, this should be set to your actual MongoDB connection string.
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/whizlite_sessions";

const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  sessionData: { type: String, required: true },
});

const Session = mongoose.model('Session', sessionSchema);

const connectToDatabase = async () => {
  try {
    if (!MONGO_URI) {
      console.error("FATAL: MONGO_URI is not defined. Please set it in your environment variables.");
      process.exit(1);
    }
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Successfully connected to MongoDB.');
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1); // Exit the process with an error code
  }
};

/**
 * Saves or updates a session in the database.
 * @param {string} sessionId - The unique identifier for the session.
 * @param {string} sessionData - The session data to be stored.
 */
const saveSession = async (sessionId, sessionData) => {
  try {
    await Session.findOneAndUpdate(
      { sessionId },
      { sessionData },
      { upsert: true, new: true }
    );
    console.log(`Session saved for sessionId: ${sessionId}`);
  } catch (error) {
    console.error(`Error saving session for sessionId: ${sessionId}`, error);
  }
};

/**
 * Retrieves a session from the database.
 * @param {string} sessionId - The unique identifier for the session.
 * @returns {Promise<object|null>} - The session object or null if not found.
 */
const getSession = async (sessionId) => {
  try {
    const session = await Session.findOne({ sessionId });
    return session;
  } catch (error) {
    console.error(`Error retrieving session for sessionId: ${sessionId}`, error);
    return null;
  }
};

/**
 * Deletes a session from the database.
 * @param {string} sessionId - The unique identifier for the session.
 */
const deleteSession = async (sessionId) => {
  try {
    await Session.deleteOne({ sessionId });
    console.log(`Session deleted for sessionId: ${sessionId}`);
  } catch (error) {
    console.error(`Error deleting session for sessionId: ${sessionId}`, error);
  }
};


module.exports = {
  connectToDatabase,
  Session,
  saveSession,
  getSession,
  deleteSession,
};
