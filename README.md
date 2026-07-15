# Student Management System (MERN Stack)
A full-stack Student Management System built with React, Node.js, Express, and MongoDB. The application enables administrators to securely manage student records through authentication, CRUD operations, dashboard analytics, and email notifications. It also includes Docker support and automated testing using Jest and Supertest.

## Table of Contents

- Features
- Tech Stack
- Installation
- Docker Setup
- Environment Variables
- Design Patterns Used
- Screenshots
- License


## Features

- User authentication using JWT
- Student CRUD operations
- Dashboard for student management
- Email notifications using Resend
- MongoDB database integration
- Docker support
- Unit and integration testing with Jest and Supertest

## Tech Stack

### Frontend
- React
- Vite

### Backend
- Node.js
- Express.js

### Database
- MongoDB

### Testing
- Jest
- Supertest

### Containerization
- Docker
- Docker Compose


## Installation

### Backend

```bash
cd student-management-backend
npm install
```

### Frontend

```bash
npm install
npm run dev
```


## Docker Setup

### Prerequisites
- Docker Desktop installed and running

### Environment Variables

Inside `student-management-backend`, copy the example file:

```bash
cp .env.example .env
```


Update the values in `.env` with your own credentials.

Required variables:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
PORT=5000
RESEND_API_KEY=your_resend_api_key
```

On Windows (PowerShell):

```powershell
Copy-Item .env.example .env
```

### Running with Docker Compose (recommended)
From the project root:
```bash
docker compose up
```

This builds and starts three containers:
- `mongo` — official MongoDB image, exposed on port 27017
- `backend` — Node/Express API, exposed on port 5000
- `frontend` — React app, built and served via nginx on port 8081

Once running, open `http://localhost:8081` in your browser.

To stop:

```bash
docker compose down
```

### Running Services Individually

**Backend**

```bash
cd student-management-backend

docker build -t student-backend .
docker run -p 5000:5000 --env-file .env student-backend
```

**Frontend**

```bash

docker build -t student-frontend .
docker run -p 8081:80 student-frontend
```


## Design Patterns Used

### Singleton — config/db.js
An isConnected flag guards connectDB() against opening a second MongoDB connection if called more than once. Guarantees exactly one shared connection for the app's lifetime.

### Factory — utils/tokenFactory.js
createAuthToken(user) centralizes JWT creation in one place. Any part of the app needing a token calls this function instead of duplicating jwt.sign(...) details (secret, algorithm, payload shape).

### Strategy — utils/notificationStrategies.js
getNotificationStrategy(type) picks which notification implementation to use at runtime. Callers (e.g. forgot-password) always call the same interface regardless of which concrete sender they get back.

### Observer — events/authEvents.js + listeners/authListeners.js
Login emits a "userLoggedIn" event instead of directly writing an audit log. A separate listener reacts to it. Decouples "what happened" from "what should happen as a result," so new reactions can be added without touching the login route.

### Adapter — utils/sendEmail.js (Resend) and utils/sendNotificationEmail.js (Nodemailer/Gmail)
Two different email providers, each wrapped behind the identical (to, subject, text) interface. Callers never know or care which provider is underneath — this uniformity is what made Strategy Pattern possible on top of them.

### Dependency Injection — repositories/BaseRepository.js + services/BaseService.js
Generic CRUD/business-logic classes that receive their Model/Repository via constructor injection rather than hardcoding it. UserRepository/UserService extend these bases, so common logic is written once and reused, and dependencies can be swapped (e.g., for testing) without changing the base classes.

### DRY / Clean Code — utils/responseHandler.js, utils/constants.js, utils/validators.js
Extracted repeated response-shaping, hardcoded strings, and field-validation logic out of authRoutes.js into shared modules, removing duplication across routes.