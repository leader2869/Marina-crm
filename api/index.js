// Vercel serverless function entry point
// This file is used by Vercel to handle all requests
const app = require('../dist/server').default || require('../dist/server');

// Export the Express app as a serverless function
module.exports = app;

