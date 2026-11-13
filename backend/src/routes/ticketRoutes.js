const express = require('express')
const {
  createTicket,
  getTickets,
  getTicketById,
  updateTicketStatus,
  assignTicket,
  addComment,
  getComments,
  deleteTicket,
} = require('../controllers/ticketController')
const { protect } = require('../middleware/authMiddleware')
const { authorize } = require('../middleware/roleMiddleware')

const router = express.Router()

router.post('/', protect, createTicket)
router.get('/', protect, getTickets)
router.get('/:id', protect, getTicketById)
router.patch('/:id/status', protect, updateTicketStatus)
router.patch('/:id/assign', protect, authorize('admin'), assignTicket)
router.post('/:id/comments', protect, addComment)
router.get('/:id/comments', protect, getComments)
router.delete('/:id', protect, authorize('admin'), deleteTicket)

module.exports = router
