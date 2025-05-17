const express = require('express');
const path = require('path');
const app = express();

// Serve static files from the root directory
app.use(express.static('.'));

// Serve index.html for all routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 