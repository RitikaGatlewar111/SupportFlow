# SupportFlow – AI-Powered Customer Support Ticket Management System

SupportFlow is a full-stack MERN application designed to simplify customer support operations. It allows customers to raise and track support tickets, agents to manage and resolve issues, and administrators to monitor support activities through an analytics dashboard.

The application integrates AI-powered ticket classification to automatically identify ticket categories, priorities, and customer sentiment.

## 🚀 Features

### 👤 Customer
- Register and log in securely.
- Create support tickets.
- View and track submitted tickets.
- Check ticket status and assigned agents.
- Communicate with support agents through comments.
- Receive notifications about ticket updates and replies.
- Search, filter, and sort tickets.

### 🛠️ Support Agent
- View assigned support tickets.
- Access customer and ticket details.
- Respond to customer queries.
- Update ticket statuses.
- Receive notifications about ticket assignments and replies.
- Search, filter, and sort assigned tickets.

### 👨‍💼 Administrator
- Access the admin dashboard.
- View and manage all support tickets.
- Assign tickets to support agents.
- Manage agent accounts and activation status.
- Monitor ticket statistics and performance.
- View analytics through interactive charts.
- Search, filter, and sort tickets.
- Receive notifications about new tickets.

### 🤖 AI-Powered Ticket Classification
- Automatically identifies ticket categories.
- Determines ticket priority.
- Analyzes customer sentiment.
- Helps support teams organize and prioritize customer issues.

### 🔔 Notification System
- Notifications for new tickets.
- Ticket assignment notifications.
- Notifications for customer and agent replies.
- Ticket status update notifications.
- Mark individual notifications as read or mark all as read.

### 📊 Admin Analytics
- Ticket status distribution.
- Ticket priority distribution.
- Ticket category distribution.
- Daily and monthly ticket trends.
- Agent-wise assigned and resolved ticket statistics.

## 🧰 Technologies Used

**Frontend**
- React.js
- Vite
- JavaScript
- HTML5
- CSS3
- Axios
- React Router
- Bootstrap

**Backend**
- Node.js
- Express.js
- MongoDB
- Mongoose
- JSON Web Token (JWT)
- bcrypt
- REST API

**AI Integration**
- Google Gemini API

**Development Tools**
- Visual Studio Code
- Postman
- MongoDB Atlas
- MongoDB Compass

## 🏗️ Project Architecture

The application follows a client-server architecture.

- **Frontend:** Provides role-based dashboards and user interfaces.
- **Backend:** Handles authentication, ticket operations, notifications, analytics, and API requests.
- **Database:** MongoDB stores users, tickets, comments, and notifications.
- **AI Service:** Integrates the Gemini API for ticket classification.

## 📁 Project Structure

```text
SupportFlow/
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── ...
│   ├── public/
│   ├── package.json
│   └── ...
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   └── services/
│   ├── server.js
│   ├── package.json
│   └── ...
│
└── README.md
```

*Note: The structure above is a simplified overview. Adjust it if your actual folder structure differs.*

## ⚙️ Installation and Setup

### 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

### 2. Open the Project

```bash
cd SupportFlow
```

### 3. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 4. Install Backend Dependencies

Open another terminal:

```bash
cd backend
npm install
```

### 5. Configure Environment Variables

Create a `.env` file inside the `backend` folder.

Add the following variables:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=1d
GEMINI_API_KEY=your_gemini_api_key
```

Replace the placeholder values with your own credentials.

**Important:** Never upload your `.env` file, API keys, database credentials, or JWT secrets to GitHub.

### 6. Run the Backend

```bash
cd backend
npm start
```

### 7. Run the Frontend

Open another terminal:

```bash
cd frontend
npm run dev
```

Open the local URL displayed in your terminal, usually:

```text
http://localhost:5173
```

## 🔐 Authentication and Security

- JWT-based authentication.
- Password hashing using bcrypt.
- Role-based access control.
- Protected API routes.
- Separate access permissions for customers, agents, and administrators.

## 🎯 Project Objective

The main objective of SupportFlow is to build an organized customer support platform that simplifies ticket handling, improves communication between customers and support teams, and uses AI to assist with ticket classification and prioritization.

## 🔮 Future Enhancements

- Real-time notifications using WebSockets.
- Email notifications.
- Cloud deployment.
- Advanced analytics and reporting.
- AI-generated response suggestions.

## 👩‍💻 Developed By

**Ritika Gatlewar**

Full-Stack Development Project

**Technologies:** MERN Stack | REST APIs | AI Integration

---

⭐ If you find this project useful, consider giving it a star!
