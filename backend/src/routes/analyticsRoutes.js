const express = require('express')
const {
  getTicketStatusAnalytics,
  getTicketPriorityAnalytics,
  getTicketCategoryAnalytics,
  getTicketTrends,
  getAgentAnalytics,
} = require('../controllers/analyticsController')
const { protect } = require('../middleware/authMiddleware')
const { authorize } = require('../middleware/roleMiddleware')

const router = express.Router()

router.get('/status', protect, authorize('admin'), getTicketStatusAnalytics)
router.get('/priority', protect, authorize('admin'), getTicketPriorityAnalytics)
router.get('/category', protect, authorize('admin'), getTicketCategoryAnalytics)
router.get('/tickets-over-time', protect, authorize('admin'), getTicketTrends)
router.get('/agents', protect, authorize('admin'), getAgentAnalytics)

module.exports = router
