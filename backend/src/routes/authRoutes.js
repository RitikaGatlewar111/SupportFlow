const express = require('express')
const {
  register,
  login,
  getAllUsers,
  updateUserStatus,
} = require('../controllers/authController')
const { protect } = require('../middleware/authMiddleware')
const { authorize } = require('../middleware/roleMiddleware')

const router = express.Router()

router.post('/register', register)
router.post('/login', login)
router.get('/users', protect, authorize('admin'), getAllUsers)
router.patch('/users/:id/status', protect, authorize('admin'), updateUserStatus)

module.exports = router