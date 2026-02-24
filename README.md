# Setup

## Prerequisites
- Redis server running on your Linux machine
- Node.js (v14 or higher)
- npm or yarn

## Installation

1. **Configure Redis**
   ```bash
   # Update Redis config with your settings
   sudo nano /etc/redis/redis.conf
   # Set password and bind to localhost
   ```

2. **Set up environment variables**
   ```bash
   # Copy example env file
   cp .env.example .env
   # Edit with your Redis credentials
   nano .env
   ```

3. **Install dependencies and run**
   ```bash
   cd backend
   npm install
   node src/server.js
   ```

# API Endpoints

## Generate Captcha
```http
GET http://localhost:3000/api/captcha
```

**Response:**
```json
{
  "success": true,
  "data": {
    "captchaId": "123e4567-e89b-12d3-a456-426614174000",
    "image": "<svg>...</svg>"
  }
}
```

## User Login
```http
POST http://localhost:3000/api/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123",
  "captcha": "ABC123",
  "captchaId": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Success Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

# Features

- **Captcha Validation** - Server-side SVG captcha with one-time usage
- **Rate Limiting** - Redis-based rate limiting (5 attempts per 15 minutes)
- **IP Blocking** - Automatic IP blocking after 5 failed attempts
- **JWT Authentication** - Secure token-based authentication
- **Redis Integration** - Session management and rate limiting

# Testing

```bash
# Get captcha
curl http://localhost:3000/api/captcha

# Test rate limiting (run 6 times)
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"wrong","captcha":"wrong","captchaId":"wrong"}'
done
```

# Environment Variables

```env
PORT=3000
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
CAPTCHA_TTL=120
MAX_CAPTCHA_FAILURES=5
IP_BLOCK_TIME=600
JWT_SECRET=your_jwt_secret
```

---
