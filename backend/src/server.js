const path = require('path')
const cors = require('cors')
const dotenv = require('dotenv')
const express = require('express')
const connectDB = require('./config/db')
const authRoutes = require('./routes/authRoutes')
const ticketRoutes = require('./routes/ticketRoutes')
const notificationRoutes = require('./routes/notificationRoutes')
const analyticsRoutes = require('./routes/analyticsRoutes')
const { protect } = require('./middleware/authMiddleware')
const { authorize } = require('./middleware/roleMiddleware')
const { getMe } = require('./controllers/authController')

dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

const app = express()
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())
app.use('/api/auth', authRoutes)
app.use('/api/tickets', ticketRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/admin/analytics', analyticsRoutes)

app.get('/api/auth/me', protect, getMe)

app.get('/api/test/customer', protect, authorize('customer'), (req, res) => {
  res.status(200).json({ message: 'Customer access granted.' })
})

app.get('/api/test/agent', protect, authorize('agent'), (req, res) => {
  res.status(200).json({ message: 'Agent access granted.' })
})

app.get('/api/test/admin', protect, authorize('admin'), (req, res) => {
  res.status(200).json({ message: 'Admin access granted.' })
})

app.get('/api/test/agent-admin', protect, authorize('agent', 'admin'), (req, res) => {
  res.status(200).json({ message: 'Agent or admin access granted.' })
})

app.get('/', (req, res) => {
  res.send('Welcome to SupportFlow API')
})

async function startServer() {
  try {
    await connectDB()
  } catch {
    console.error(
      'MongoDB connection failed. Check MONGO_URI and your Atlas connection settings.',
    )
    process.exitCode = 1
    return
  }

  app.listen(port, () => {
    console.log(`SupportFlow API is running on port ${port}`)
  })
}

startServer()

module.exports = app
