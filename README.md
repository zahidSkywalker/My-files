# 🎰 Royal Casino Website

A professional-grade online casino website built with Node.js, Express, MongoDB, and modern web technologies. Features SSL Commerce payment integration, custom casino games, and a stunning responsive design.

## ✨ Features

### 🎮 Casino Games
- **Royal Slots** - 5-reel slot machine with royal theme
- **Royal Blackjack** - Classic blackjack with royal payouts
- **Royal Roulette** - European roulette with betting options
- **Royal Poker** - Texas Hold'em with royal flush bonus
- **Royal Baccarat** - Classic baccarat with side bets
- **Royal Dice** - Dice game with multipliers
- **Royal Lottery** - Daily lottery with jackpots

### 💳 Payment Integration
- **SSL Commerce** integration for secure payments
- Support for multiple payment methods
- Real-time transaction processing
- Comprehensive payment history

### 🔐 User Management
- User registration and authentication
- KYC verification system
- Profile management
- Balance tracking
- Gaming history

### 🎨 Design & UX
- Modern, responsive design
- Smooth animations and transitions
- Mobile-first approach
- Professional casino aesthetics
- Interactive game interfaces

### 🛡️ Security Features
- JWT authentication
- Password encryption
- Account lockout protection
- Secure payment processing
- Input validation

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd casino-website
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/casino
   JWT_SECRET=your_super_secret_jwt_key_for_casino_website_2024
   SSL_COMMERCE_STORE_ID=airsn68981bba6ded8
   SSL_COMMERCE_STORE_PASSWORD=airsn68981bba6ded8@ssl
   SSL_COMMERCE_SANDBOX=true
   NODE_ENV=development
   ```

4. **Start MongoDB**
   ```bash
   # Start MongoDB service
   sudo systemctl start mongod
   
   # Or start MongoDB manually
   mongod
   ```

5. **Run the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

6. **Access the website**
   Open your browser and navigate to `http://localhost:3000`

## 🏗️ Project Structure

```
casino-website/
├── src/
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── middleware/      # Authentication & validation
│   ├── public/          # Static assets
│   │   ├── css/         # Stylesheets
│   │   ├── js/          # JavaScript files
│   │   ├── images/      # Images and icons
│   │   └── games/       # Game assets
│   ├── views/           # EJS templates
│   ├── config/          # Configuration files
│   └── server.js        # Main server file
├── .env                 # Environment variables
├── package.json         # Dependencies and scripts
└── README.md           # This file
```

## 🎯 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update profile
- `POST /api/auth/logout` - User logout

### Games
- `GET /api/games/available` - Get available games
- `POST /api/games/start` - Start a new game
- `POST /api/games/result` - Process game result
- `GET /api/games/history` - Get game history
- `GET /api/games/stats` - Get game statistics

### Payments
- `POST /api/payments/deposit` - Create deposit
- `GET /api/payments/history` - Get transaction history
- `GET /api/payments/:id` - Get transaction details

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update profile
- `GET /api/users/stats` - Get user statistics
- `GET /api/users/gaming-history` - Get gaming history

### Admin (Protected)
- `GET /api/admin/dashboard` - Admin dashboard
- `GET /api/admin/casino-status` - Casino status
- `GET /api/admin/financial-reports` - Financial reports
- `GET /api/admin/game-performance` - Game performance

## 🎮 Game Implementation

### Slot Machine
- 5-reel, 3-row slot machine
- Multiple paylines
- Random number generation
- Win line detection
- Payout calculations

### Blackjack
- Standard blackjack rules
- Dealer AI
- Card counting prevention
- Split and double down options

### Roulette
- European roulette wheel
- Multiple betting options
- Random number generation
- Payout calculations

### Poker
- Texas Hold'em rules
- Hand evaluation
- Betting rounds
- AI opponents

## 💳 SSL Commerce Integration

The website integrates with SSL Commerce for secure payment processing:

- **Sandbox Mode**: Configured for testing
- **Production Mode**: Ready for live transactions
- **IPN Support**: Instant payment notifications
- **Callback Handling**: Success/failure/cancel callbacks
- **Transaction Tracking**: Complete payment history

### Payment Flow
1. User initiates deposit
2. SSL Commerce payment form
3. Payment processing
4. IPN notification
5. Balance update
6. Transaction confirmation

## 🎨 Customization

### Styling
- CSS variables for easy color customization
- Modular CSS architecture
- Responsive design breakpoints
- Animation system

### Themes
- Dark theme (default)
- Easy to implement light theme
- Custom color schemes
- Brand customization

### Games
- Modular game architecture
- Easy to add new games
- Configurable game parameters
- Custom game logic

## 🔧 Development

### Scripts
```bash
npm run dev      # Start development server with nodemon
npm start        # Start production server
npm test         # Run tests (to be implemented)
```

### Code Style
- ES6+ JavaScript
- Async/await patterns
- Error handling
- Input validation
- Security best practices

### Database
- MongoDB with Mongoose ODM
- Indexed collections
- Data validation
- Relationship management

## 🚀 Deployment

### Production Setup
1. Set `NODE_ENV=production`
2. Configure production MongoDB
3. Set production SSL Commerce credentials
4. Use PM2 or similar process manager
5. Configure reverse proxy (Nginx)

### Environment Variables
```env
NODE_ENV=production
MONGODB_URI=mongodb://production-db:27017/casino
JWT_SECRET=production_secret_key
SSL_COMMERCE_SANDBOX=false
SSL_COMMERCE_STORE_ID=production_store_id
SSL_COMMERCE_STORE_PASSWORD=production_password
```

### Docker Support
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🛡️ Security Considerations

### Authentication
- JWT tokens with expiration
- Password hashing (bcrypt)
- Account lockout protection
- Session management

### Data Protection
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CSRF protection

### Payment Security
- SSL/TLS encryption
- Payment gateway integration
- Transaction verification
- Secure callback handling

## 📱 Mobile Support

- Responsive design
- Touch-friendly interfaces
- Mobile-optimized games
- Progressive Web App features

## 🌐 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers

## 📊 Performance

- Optimized database queries
- Efficient caching strategies
- Compressed assets
- Lazy loading
- CDN ready

## 🔍 SEO Features

- Meta tags optimization
- Structured data
- Sitemap generation
- Performance optimization
- Mobile-friendly design

## 📈 Monitoring & Analytics

- Game performance tracking
- User behavior analytics
- Financial reporting
- System health monitoring
- Error logging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## ⚠️ Disclaimer

This is a demonstration project for educational purposes. For production use:

- Ensure compliance with local gambling laws
- Implement proper security measures
- Add comprehensive testing
- Include responsible gambling features
- Consult legal professionals

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the code comments

## 🔮 Future Enhancements

- Live dealer games
- Multiplayer functionality
- Advanced analytics
- Mobile app
- Cryptocurrency support
- Social features
- Tournament system

---

**Built with ❤️ for the ultimate casino gaming experience**
