# BloodLife - Blood Donation Management System

A comprehensive blood donation management system with donor registration, blood request handling, admin dashboard, and intelligent matching.

## 🚀 Features

### Core Features
- ✅ **Donor Management**: Register, update, and track blood donors
- ✅ **Blood Request System**: Submit and manage blood donation requests
- ✅ **Smart Matching**: Automatic blood type compatibility matching
- ✅ **Eligibility Tracking**: 90-day donation interval enforcement
- ✅ **Admin Dashboard**: Complete management interface with analytics
- ✅ **Notifications**: Email notifications for matches and updates

### Security Features
- 🔒 JWT Authentication with secure token management
- 🔒 Password hashing with bcrypt
- 🔒 Input validation and sanitization
- 🔒 Rate limiting on all endpoints
- 🔒 Helmet security headers
- 🔒 CORS protection

### Advanced Features
- 📊 Analytics dashboard with real-time statistics
- 🔔 Automated donor-request matching
- ⚡ Emergency request prioritization
- 📄 Pagination on all list endpoints
- 📝 Comprehensive API documentation (Swagger)
- 🔍 Advanced search and filtering

## 🌱 Load Demo Data

We've included 15 complete donor profiles with accounts, donation history, and blood requests for testing.

**Quick setup:**
```bash
npm run seed
```

Or manually:
```bash
node seed-demo-data.js
```

**Demo Login Credentials:**
- **Donor Accounts**: Use any email from DEMO_USERS.md
- **Password**: `Demo@12345`
- **Admin**: username `admin`, password `Admin@12345`

See `DEMO_USERS.md` for complete list of test accounts and data.

---

## 📋 Prerequisites

- Node.js (v14 or higher)
- MySQL (v5.7 or higher)
- npm or yarn

## ⚙️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd blood
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration:
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=blood_donation_system
   PORT=3000
   JWT_SECRET=your_super_secret_jwt_key_at_least_32_chars
   ```

4. **Start the server**
   ```bash
   npm start
   ```
   For development with auto-reload:
   ```bash
   npm run dev
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - API Documentation: http://localhost:3000/api-docs
   - Admin Login: http://localhost:3000/admin-login.html

## 🔑 Default Admin Credentials

- **Username**: `admin`
- **Password**: `Admin@12345`

⚠️ **Change these credentials immediately in production!**

## 📚 API Documentation

### Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Key Endpoints

#### Admin
- `POST /api/admin/login` - Admin login
- `GET /api/admin/analytics` - Get system analytics
- `POST /api/admin/users` - Create new admin (super_admin only)

#### Donors
- `GET /api/donors` - List all donors (with pagination & filters)
- `POST /api/donors/register` - Register new donor
- `GET /api/donors/:id` - Get donor details
- `PUT /api/donors/:id` - Update donor (auth required)
- `GET /api/donors/:id/eligibility` - Check donation eligibility
- `GET /api/donors/compatible/:bloodGroup` - Get compatible donors

#### Blood Requests
- `GET /api/requests` - List all requests (with pagination & filters)
- `POST /api/requests` - Create new request
- `PUT /api/requests/:id/status` - Update request status (auth required)
- `DELETE /api/requests/:id` - Delete request (auth required)

### Query Parameters

**Pagination:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)

**Filters:**
- `blood_group` - Filter by blood group
- `availability` - Filter donors by availability (0/1)
- `status` - Filter requests by status
- `emergency` - Filter emergency requests (0/1)
- `location` - Search by location (partial match)

### Example Requests

**Register a Donor:**
```bash
curl -X POST http://localhost:3000/api/donors/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullname": "John Doe",
    "age": 28,
    "gender": "Male",
    "blood_group": "O+",
    "phone": "+1234567890",
    "email": "john@example.com",
    "address": "123 Main St, City"
  }'
```

**Create Blood Request:**
```bash
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -d '{
    "patient_name": "Jane Smith",
    "blood_group": "O+",
    "units": 2,
    "hospital": "City Hospital",
    "phone": "+1234567890",
    "needed_date": "2026-02-20",
    "is_emergency": true
  }'
```

**Admin Login:**
```bash
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "Admin@12345"
  }'
```

## 🏗️ Project Structure

```
blood/
├── config/           # Configuration files
│   ├── database.js   # Database connection & migrations
│   └── swagger.js    # API documentation config
├── middleware/       # Express middleware
│   ├── errorHandler.js    # Error handling
│   ├── rateLimiter.js     # Rate limiting
│   └── validator.js       # Input validation
├── routes/          # API route handlers
│   ├── admin.js     # Admin endpoints
│   ├── donors.js    # Donor endpoints
│   └── requests.js  # Request endpoints
├── utils/           # Utility functions
│   ├── bloodCompatibility.js  # Blood matching logic
│   ├── logger.js              # Winston logger
│   └── notificationService.js # Email notifications
├── logs/            # Application logs
├── assets/          # Static assets
├── css/             # Stylesheets
├── js/              # Frontend JavaScript
├── .env             # Environment variables
├── server.js        # Main application file
├── database.sql     # Initial database schema
├── database-migration.sql  # Database migrations
└── package.json     # Dependencies
```

## 🧪 Testing

Run tests:
```bash
npm test
```

Run tests with coverage:
```bash
npm test -- --coverage
```

## 📊 Database Schema

### Tables
- `admins` - Admin users with role-based access
- `donors` - Blood donor information
- `blood_requests` - Blood donation requests
- `donations` - Donation history tracking
- `notifications` - Notification queue and history
- `donor_accounts` - Donor self-service accounts

### Blood Compatibility Matrix
- **A+** can receive from: A+, A-, O+, O-
- **A-** can receive from: A-, O-
- **B+** can receive from: B+, B-, O+, O-
- **B-** can receive from: B-, O-
- **AB+** (Universal Recipient): Can receive from all blood types
- **AB-** can receive from: A-, B-, AB-, O-
- **O+** can receive from: O+, O-
- **O-** (Universal Donor): Can only receive from O-

## 🔧 Configuration

### Email Notifications
Configure SMTP settings in `.env`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@bloodlife.com
```

### Rate Limiting
```env
RATE_LIMIT_WINDOW_MS=900000      # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100      # 100 requests per window
LOGIN_RATE_LIMIT_MAX=5           # 5 login attempts per window
```

## 🚀 Production Deployment

1. Set `NODE_ENV=production` in `.env`
2. Use a strong JWT_SECRET (min 32 characters)
3. Configure proper SMTP credentials
4. Set up HTTPS/SSL
5. Configure CORS allowed origins
6. Use a process manager (PM2 recommended)
7. Set up database backups
8. Configure proper logging

### PM2 Example
```bash
npm install -g pm2
pm2 start server.js --name bloodlife
pm2 save
pm2 startup
```

## 📝 Changelog

### Version 1.0.0
- ✅ Complete security overhaul
- ✅ JWT authentication
- ✅ Input validation & sanitization
- ✅ Rate limiting
- ✅ Advanced donor-request matching
- ✅ Eligibility tracking (90-day rule)
- ✅ Email notifications
- ✅ Analytics dashboard
- ✅ Multi-admin support
- ✅ Emergency request flagging
- ✅ Pagination
- ✅ API documentation (Swagger)
- ✅ Comprehensive logging
- ✅ Error handling middleware

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

ISC License

## 🆘 Support

For issues and questions:
- Create an issue on GitHub
- Email: support@bloodlife.com

## 🙏 Acknowledgments

- Built with Express.js
- Uses MySQL for data storage
- Winston for logging
- Swagger for API documentation
- Helmet for security headers

---

**Made with ❤️ for saving lives**
