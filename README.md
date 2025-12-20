# 💬 Real-Time Chat Application

> A modern, full-featured real-time chat application built with Node.js, Express, Socket.IO, and PostgreSQL.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.x-black?logo=express)](https://expressjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-336791?logo=postgresql)](https://www.postgresql.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-black?logo=socket.io)](https://socket.io/)

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Installation](#-installation)
- [Environment Variables](#-environment-variables)
- [Database Setup](#-database-setup)
- [Running the Application](#-running-the-application)
- [API Documentation](#-api-documentation)
- [WebSocket Events](#-websocket-events)
- [API Endpoints](#-api-endpoints)
- [Contributing](#-contributing)

---

## ✨ Features

### 🔐 Authentication & Security

- **User Registration** - Create accounts with email, username, and password
- **Secure Login** - JWT-based authentication with access and refresh tokens
- **Password Management** - Change password with old password verification
- **Session Management** - Automatic token refresh and logout functionality

### 💭 Messaging Features

- **Real-Time Messaging** - Instant message delivery using WebSocket
- **Group Chats** - Create and manage group conversations
- **Direct Messages** - One-on-one private conversations
- **File Attachments** - Share documents and media files
- **Link Previews** - Automatic link preview generation
- **Message History** - Full message history with pagination
- **Message Deletion** - Delete sent messages (owner or admin only)
- **Read Receipts** - Track message read status

### 👥 User Management

- **User Profiles** - Customizable avatars and usernames
- **Search Users** - Find users by username or email
- **Online Status** - Track user availability
- **Account Management** - Update email and username

### 🏠 Room Management

- **Create Rooms** - Start group chats with descriptions
- **Room Avatars** - Custom room profile pictures
- **Participant Management** - Add/remove members (admin only)
- **Room Search** - Discover and search public rooms
- **Leave Rooms** - Exit group conversations

### 📊 Additional Features

- **Rate Limiting** - Protection against abuse
- **CORS Support** - Cross-origin resource sharing
- **Comprehensive Logging** - Winston-based logging system
- **API Documentation** - Swagger/OpenAPI integration
- **Input Validation** - Zod schema validation

---

## 🛠️ Tech Stack

### Backend

- **Runtime**: Node.js v18+
- **Framework**: Express.js 5.x
- **Language**: TypeScript 5.x
- **Real-Time**: Socket.IO 4.x

### Database

- **Primary DB**: PostgreSQL 14+
- **ORM**: Drizzle ORM
- **Migrations**: Drizzle Kit

### Authentication & Security

- **JWT**: jsonwebtoken 9.x
- **Password Hashing**: bcrypt
- **Validation**: Zod

### File Management

- **Cloud Storage**: Cloudinary
- **Local Upload**: Multer

### Additional Tools

- **Logging**: Winston
- **API Documentation**: Swagger-JSDoc
- **CORS**: cors middleware
- **Rate Limiting**: express-rate-limit
- **Environment Variables**: dotenv

---

## 📁 Project Structure

```
my-chat-app/
├── src/
│   ├── config/              # Configuration files
│   │   ├── env.ts          # Environment variables setup
│   │   ├── constants.ts    # Application constants
│   │   └── swagger.ts      # Swagger/OpenAPI config
│   ├── controllers/         # Route controllers
│   │   ├── auth.controllers.ts
│   │   ├── room.controllers.ts
│   │   └── message.controllers.ts
│   ├── routes/              # API routes
│   │   ├── auth.routes.ts
│   │   ├── room.routes.ts
│   │   └── message.route.ts
│   ├── db/                  # Database setup
│   │   ├── index.ts        # DB connection
│   │   └── schema.ts       # Database schema
│   ├── docs/                # Swagger documentation
│   │   ├── auth.swagger.ts
│   │   ├── room.swagger.ts
│   │   └── message.swagger.ts
│   ├── middlewares/         # Express middlewares
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   ├── multer.middleware.ts
│   │   └── validator.middleware.ts
│   ├── socket/              # WebSocket handlers
│   │   └── index.ts
│   ├── utils/               # Utility functions
│   │   ├── ApiError.ts
│   │   ├── ApiResponse.ts
│   │   ├── asyncHandler.ts
│   │   ├── cloudinary.ts
│   │   ├── linkPreview.ts
│   │   └── logger.ts
│   ├── validators/          # Zod validation schemas
│   │   ├── auth.validator.ts
│   │   ├── room.validator.ts
│   │   └── message.validator.ts
│   ├── types/               # TypeScript type definitions
│   │   └── express.d.ts
│   ├── app.ts              # Express app setup
│   └── index.ts            # Entry point
├── drizzle/                 # Database migrations
├── public/                  # Static files
├── logs/                    # Application logs
├── .env.example            # Environment template
├── drizzle.config.ts       # Drizzle configuration
├── tsconfig.json           # TypeScript config
└── package.json            # Dependencies
```

---

## 🚀 Installation

### Prerequisites

- Node.js v18 or higher
- PostgreSQL 14 or higher
- npm or yarn package manager
- Cloudinary account (for file uploads)

### Step 1: Clone the Repository

```bash
git clone https://github.com/Archan-07/my-chat-app.git
cd my-chat-app
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Set Up Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

---

## 🔧 Environment Variables

```env
# Server Configuration
PORT=8001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/chat_app

# JWT Authentication
ACCESS_TOKEN_SECRET=your_secure_access_token_secret
ACCESS_TOKEN_EXPIRY=1d
REFRESH_TOKEN_SECRET=your_secure_refresh_token_secret
REFRESH_TOKEN_EXPIRY=10d

# Cloudinary (File Upload)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

## 🗄️ Database Setup

### Step 1: Create PostgreSQL Database

```bash
createdb chat_app
```

### Step 2: Run Migrations

```bash
npm run db:generate  # Generate migrations
npm run db:migrate   # Apply migrations
```

### Step 3: View Database (Optional)

```bash
npm run db:studio    # Open Drizzle Studio
```

---

## ▶️ Running the Application

### Development Mode

```bash
npm run dev
```

The application will start on `http://localhost:8001` by default.

### Production Build

```bash
npm run build
npm start
```

---

## 📚 API Documentation

### Swagger UI

Once the application is running, access the interactive API documentation at:

```
http://localhost:8001/api-docs
```

### API Base URL

```
http://localhost:8001/api/v1
```

---

## 🌐 API Endpoints

### 🔐 Authentication Routes

| Method | Endpoint                        | Description           | Auth |
| ------ | ------------------------------- | --------------------- | ---- |
| POST   | `/users/register`               | Register new user     | ❌   |
| POST   | `/users/login`                  | Login user            | ❌   |
| POST   | `/users/refresh-access-token`   | Refresh access token  | ❌   |
| POST   | `/users/logout`                 | Logout user           | ✅   |
| GET    | `/users/get-current-user`       | Get current user info | ✅   |
| POST   | `/users/change-password`        | Change password       | ✅   |
| PUT    | `/users/update-account-details` | Update email/username | ✅   |
| PUT    | `/users/update-avatar`          | Update user avatar    | ✅   |
| DELETE | `/users/delete-user`            | Delete user account   | ✅   |
| GET    | `/users/find-user`              | Search users          | ✅   |

### 🏠 Room Routes

| Method | Endpoint                             | Description                | Auth |
| ------ | ------------------------------------ | -------------------------- | ---- |
| POST   | `/rooms/create-room`                 | Create new room            | ✅   |
| GET    | `/rooms/get-rooms`                   | Get user's rooms           | ✅   |
| GET    | `/rooms/search`                      | Search rooms               | ✅   |
| GET    | `/rooms/:roomId`                     | Get room details           | ❌   |
| PATCH  | `/rooms/:roomId`                     | Update room (admin)        | ✅   |
| DELETE | `/rooms/:roomId`                     | Delete room (admin)        | ✅   |
| PATCH  | `/rooms/update-room-avatar/:roomId`  | Update avatar (admin)      | ✅   |
| POST   | `/rooms/add-participants/:roomId`    | Add participant (admin)    | ✅   |
| POST   | `/rooms/remove-participants/:roomId` | Remove participant (admin) | ✅   |
| POST   | `/rooms/leave/:roomId`               | Leave room                 | ✅   |
| POST   | `/rooms/dm/:receiverId`              | Create/get DM              | ✅   |

### 💬 Message Routes

| Method | Endpoint                                      | Description       | Auth |
| ------ | --------------------------------------------- | ----------------- | ---- |
| GET    | `/messages/:roomId`                           | Get room messages | ✅   |
| POST   | `/messages/send-message/:roomId`              | Send message      | ✅   |
| DELETE | `/messages/delete-message/:messageId/:roomId` | Delete message    | ✅   |
| POST   | `/messages/mark-read/:roomId`                 | Mark as read      | ✅   |

---

## 🔌 WebSocket Events

### Client → Server Events

```javascript
socket.on("receive_message", (payload) => {
  // Broadcast received message to room
});

socket.on("message_deleted", (data) => {
  // Notify room of deleted message
});

socket.on("messages_read", (data) => {
  // Notify room of read status
});
```

### Server → Client Events

```javascript
socket.emit("receive_message", messageData);
socket.emit("message_deleted", { messageId });
socket.emit("messages_read", { roomId, readByUserId, messageIds });
```

---

## 🔑 Request Examples

### Register User

```bash
curl -X POST http://localhost:8001/api/v1/users/register \
  -F "email=user@example.com" \
  -F "username=archan" \
  -F "password=securePassword123" \
  -F "avatar=@path/to/avatar.jpg"
```

### Login

```bash
curl -X POST http://localhost:8001/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"securePassword123"}'
```

### Send Message

```bash
curl -X POST http://localhost:8001/api/v1/messages/send-message/room-id \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "content=Hello World" \
  -F "attachment=@path/to/file.pdf"
```

---

## 🔒 Security Features

- ✅ **JWT Authentication** - Secure token-based authentication
- ✅ **Password Hashing** - bcrypt with salt rounds
- ✅ **Rate Limiting** - 100 requests per 15 minutes
- ✅ **CORS Protection** - Configurable CORS origins
- ✅ **Input Validation** - Zod schema validation
- ✅ **Error Handling** - Comprehensive error middleware
- ✅ **Secure Headers** - HTTP security headers
- ✅ **File Validation** - Cloudinary-based file handling

---

## 📝 Logging

Logs are stored in the `logs/` directory using Winston:

```
logs/
├── combined.log          # All logs
├── error.log            # Error logs only
└── 2025-12-20.log      # Daily logs
```

Configure logging level in `src/utils/logger.ts`

---


## 👨‍💻 Author

**Archan Acharya**

- Email: archanacharya31@gmail.com
- GitHub: [@Archan-07](https://github.com/Archan-07)

---

## 📞 Support

For issues, questions, or suggestions, please [open an issue](https://github.com/Archan-07/my-chat-app/issues) on GitHub.

---



## 🙏 Acknowledgments

- [Express.js](https://expressjs.com/) - Web framework
- [Socket.IO](https://socket.io/) - Real-time communication
- [Drizzle ORM](https://orm.drizzle.team/) - Database ORM
- [Cloudinary](https://cloudinary.com/) - Cloud storage
- [PostgreSQL](https://www.postgresql.org/) - Database

---

<div align="center">

Made with ❤️ by Archan Acharya

⭐ If you find this project helpful, please consider giving it a star!

</div>
