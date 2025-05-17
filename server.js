const express = require('express');
const path = require('path');
const app = express();

// Serve static files from the app directory
app.use(express.static(path.join(__dirname, 'app')));

// Serve index.html for all routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'app', 'index.html'));
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 