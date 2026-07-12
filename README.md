# Student Management System (MERN Stack)
A full-stack Student Management System built with React, Node.js, Express, and MongoDB. The application enables administrators to securely manage student records through authentication, CRUD operations, dashboard analytics, and email notifications. It also includes Docker support and automated testing using Jest and Supertest.

## Table of Contents

- Features
- Tech Stack
- Installation
- Docker Setup
- Environment Variables
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