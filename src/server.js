const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files (before routes for proper serving)
app.use(express.static(path.join(__dirname, 'public')));

// Database connection (optional for development)
const connectDB = async () => {
  try {
    if (process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      console.log('Connected to MongoDB');
    } else {
      console.log('MongoDB not configured - running in demo mode');
    }
  } catch (err) {
    console.log('MongoDB connection failed - running in demo mode');
  }
};

connectDB();

// Routes (optional for development)
try {
  // app.use('/api/auth', require('./routes/auth'));
  // app.use('/api/users', require('./routes/users'));
  // app.use('/api/games', require('./routes/games'));
  // app.use('/api/payments', require('./routes/payments'));
  // app.use('/api/admin', require('./routes/admin'));
  console.log('API routes disabled for testing');
} catch (err) {
  console.log('Some routes failed to load - running in demo mode');
}

// Main routes
app.get('/', (req, res) => {
  console.log('Main route accessed');
  res.render('index');
});

app.get('/games', (req, res) => {
  console.log('Games route accessed');
  res.render('games');
});

app.get('/casino', (req, res) => {
  console.log('Casino route accessed');
  res.render('casino');
});

app.get('/profile', (req, res) => {
  console.log('Profile route accessed');
  res.render('profile');
});

app.get('/admin', (req, res) => {
  console.log('Admin route accessed');
  res.render('admin');
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('joinGame', (gameId) => {
    socket.join(gameId);
    console.log(`User ${socket.id} joined game ${gameId}`);
  });
  
  socket.on('gameAction', (data) => {
    socket.to(data.gameId).emit('gameUpdate', data);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});



// 404 handler
app.use((req, res) => {
  res.status(404).render('404');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Casino server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});

module.exports = { app, io };