const mongoose = require('mongoose')
const Ticket = require('../models/Ticket')
const User = require('../models/User')
const Comment = require('../models/Comment')
const { classifyTicket } = require('../services/aiService')
const { createNotification } = require('../services/notificationService')

async function createTicket(req, res) {
  const { title, description } = req.body || {}

  if (
    typeof title !== 'string' ||
    typeof description !== 'string' ||
    !title.trim() ||
    !description.trim()
  ) {
    return res.status(400).json({
      message: 'Title and description are required.',
    })
  }

  try {
    const trimmedTitle = title.trim()
    const trimmedDescription = description.trim()
    const aiSuggestions = await classifyTicket(trimmedTitle, trimmedDescription)

    const ticket = await Ticket.create({
      title: trimmedTitle,
      description: trimmedDescription,
      category: aiSuggestions.category,
      priority: aiSuggestions.priority,
      sentiment: aiSuggestions.sentiment,
      aiSuggestions: {
        category: aiSuggestions.category,
        priority: aiSuggestions.priority,
        sentiment: aiSuggestions.sentiment,
      },
      customer: req.user.id,
    })

    try {
      await createNotification({
        recipient: req.user.id,
        title: 'Ticket created',
        message: `Your ticket "${ticket.title}" was created.`,
        type: 'ticket_created',
        ticket: ticket._id,
      })
    } catch (error) {
      console.error('Failed to create customer ticket notification:', error)
    }

    try {
      const admins = await User.find({ role: 'admin', isActive: true }).select('_id')
      await Promise.all(
        admins.map((admin) =>
          createNotification({
            recipient: admin._id,
            title: 'New customer ticket',
            message: `A new ticket "${ticket.title}" was created.`,
            type: 'ticket_created',
            ticket: ticket._id,
          }),
        ),
      )
    } catch (error) {
      console.error('Failed to create admin ticket notifications:', error)
    }

    return res.status(201).json({
      message: 'Ticket created successfully.',
      ticket,
    })
  } catch {
    return res.status(500).json({ message: 'An unexpected error occurred.' })
  }
}

async function getTickets(req, res) {
  const { id, role } = req.user || {}
  const query = req.query || {}
  const supportedParameters = ['search', 'status', 'priority', 'category', 'sort']
  const unknownParameter = Object.keys(query).find(
    (parameter) => !supportedParameters.includes(parameter),
  )

  if (unknownParameter) {
    return res.status(400).json({ message: 'Unsupported ticket query parameter.' })
  }

  for (const parameter of supportedParameters) {
    if (
      Object.prototype.hasOwnProperty.call(query, parameter) &&
      typeof query[parameter] !== 'string'
    ) {
      return res.status(400).json({ message: `Invalid ${parameter} query parameter.` })
    }
  }

  const search = query.search?.trim()

  if (query.search && query.search.length > 100) {
    return res.status(400).json({ message: 'Search must be 100 characters or fewer.' })
  }

  const enumFilters = [
    ['status', 'status'],
    ['priority', 'priority'],
    ['category', 'category'],
  ]

  for (const [parameter, field] of enumFilters) {
    if (
      query[parameter] !== undefined &&
      !Ticket.schema.path(field).enumValues.includes(query[parameter])
    ) {
      return res.status(400).json({ message: `Invalid ${parameter} value.` })
    }
  }

  const sortOptions = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
  }
  const sort = query.sort === undefined ? 'newest' : query.sort

  if (!Object.prototype.hasOwnProperty.call(sortOptions, sort)) {
    return res.status(400).json({ message: 'Sort must be newest or oldest.' })
  }

  const filter = {}

  if (role === 'customer') {
    filter.customer = id
  } else if (role === 'agent') {
    filter.assignedAgent = id
  } else if (role !== 'admin') {
    return res.status(403).json({ message: 'You are not authorized to view tickets.' })
  }

  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    filter.title = { $regex: escapedSearch, $options: 'i' }
  }

  for (const [parameter, field] of enumFilters) {
    if (query[parameter] !== undefined) {
      filter[field] = query[parameter]
    }
  }

  try {
    const tickets = await Ticket.find(filter)
      .sort(sortOptions[sort])
      .populate('customer', 'name email')
      .populate('assignedAgent', 'name email')

    return res.status(200).json({
      message: 'Tickets retrieved successfully.',
      tickets,
    })
  } catch {
    return res.status(500).json({ message: 'An unexpected error occurred.' })
  }
}

async function getTicketById(req, res) {
  const ticketId = req.params.id

  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    return res.status(400).json({ message: 'Invalid ticket ID.' })
  }

  try {
    const ticket = await Ticket.findById(ticketId)

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found.' })
    }

    const { id, role } = req.user || {}

    if (
      (role === 'customer' && ticket.customer.toString() !== id) ||
      (role === 'agent' &&
        (!ticket.assignedAgent || ticket.assignedAgent.toString() !== id)) ||
      !['customer', 'agent', 'admin'].includes(role)
    ) {
      return res.status(403).json({ message: 'You are not authorized to view this ticket.' })
    }

    await ticket.populate('customer', 'name email')
    await ticket.populate('assignedAgent', 'name email')

    return res.status(200).json({
      message: 'Ticket retrieved successfully.',
      ticket,
    })
  } catch {
    return res.status(500).json({ message: 'An unexpected error occurred.' })
  }
}

async function updateTicketStatus(req, res) {
  const ticketId = req.params.id
  const { status } = req.body || {}
  const allowedStatuses = ['open', 'in_progress', 'resolved', 'closed']

  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    return res.status(400).json({ message: 'Invalid ticket ID.' })
  }

  if (typeof status !== 'string' || !allowedStatuses.includes(status)) {
    return res.status(400).json({ message: 'A valid ticket status is required.' })
  }

  try {
    const ticket = await Ticket.findById(ticketId)

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found.' })
    }

    const { id, role } = req.user || {}

    if (
      role !== 'admin' &&
      !(role === 'agent' && ticket.assignedAgent?.toString() === id)
    ) {
      return res.status(403).json({ message: 'You are not authorized to update this ticket.' })
    }

    const previousStatus = ticket.status
    const statusChanged = previousStatus !== status

    ticket.status = status
    await ticket.save()

    if (statusChanged) {
      try {
        await createNotification({
          recipient: ticket.customer,
          title: 'Ticket status updated',
          message: `The status of your ticket "${ticket.title}" changed to ${status}.`,
          type: 'ticket_status_changed',
          ticket: ticket._id,
        })
      } catch (error) {
        console.error('Failed to create ticket status notification:', error)
      }
    }

    return res.status(200).json({
      message: 'Ticket status updated successfully.',
      ticket,
    })
  } catch {
    return res.status(500).json({ message: 'An unexpected error occurred.' })
  }
}

async function assignTicket(req, res) {
  const ticketId = req.params.id
  const { agentId } = req.body || {}

  if (
    !mongoose.Types.ObjectId.isValid(ticketId) ||
    typeof agentId !== 'string' ||
    !mongoose.Types.ObjectId.isValid(agentId)
  ) {
    return res.status(400).json({ message: 'A valid ticket ID and agent ID are required.' })
  }

  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Only admins can assign tickets.' })
  }

  try {
    const ticket = await Ticket.findById(ticketId)

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found.' })
    }

    const agent = await User.findById(agentId)

    if (!agent) {
      return res.status(404).json({ message: 'User not found.' })
    }

    if (agent.role !== 'agent' || !agent.isActive) {
      return res.status(400).json({ message: 'The selected user is not an active agent.' })
    }

    const previousAgentId = ticket.assignedAgent ? ticket.assignedAgent.toString() : null
    const assignmentChanged = previousAgentId !== agent._id.toString()

    ticket.assignedAgent = agent._id
    await ticket.save()

    if (assignmentChanged) {
      try {
        await createNotification({
          recipient: agent._id,
          title: 'Ticket assigned',
          message: `The ticket "${ticket.title}" has been assigned to you.`,
          type: 'ticket_assigned',
          ticket: ticket._id,
        })
      } catch (error) {
        console.error('Failed to create assigned-agent notification:', error)
      }

      try {
        await createNotification({
          recipient: ticket.customer,
          title: 'Agent assigned',
          message: `An agent has been assigned to your ticket "${ticket.title}".`,
          type: 'ticket_assigned',
          ticket: ticket._id,
        })
      } catch (error) {
        console.error('Failed to create customer assignment notification:', error)
      }
    }

    await ticket.populate('customer', 'name email')
    await ticket.populate('assignedAgent', 'name email')

    return res.status(200).json({
      message: 'Ticket assigned successfully.',
      ticket,
    })
  } catch {
    return res.status(500).json({ message: 'An unexpected error occurred.' })
  }
}

async function addComment(req, res) {
  const ticketId = req.params.id
  const { message } = req.body || {}

  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    return res.status(400).json({ message: 'Invalid ticket ID.' })
  }

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ message: 'A non-empty comment message is required.' })
  }

  try {
    const ticket = await Ticket.findById(ticketId)

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found.' })
    }

    const { id, role } = req.user || {}
    const isCustomerOwner = role === 'customer' && ticket.customer.toString() === id
    const isAssignedAgent =
      role === 'agent' && ticket.assignedAgent?.toString() === id

    if (!isCustomerOwner && !isAssignedAgent && role !== 'admin') {
      return res.status(403).json({ message: 'You are not authorized to comment on this ticket.' })
    }

    const comment = await Comment.create({
      ticket: ticket._id,
      author: id,
      message: message.trim(),
    })

    if (role === 'customer' && ticket.assignedAgent) {
      try {
        await createNotification({
          recipient: ticket.assignedAgent,
          title: 'Customer replied',
          message: `A customer replied to the ticket "${ticket.title}".`,
          type: 'ticket_reply',
          ticket: ticket._id,
        })
      } catch (error) {
        console.error('Failed to create customer reply notification:', error)
      }
    }

    if (role === 'agent') {
      try {
        await createNotification({
          recipient: ticket.customer,
          title: 'Agent replied',
          message: `An agent replied to your ticket "${ticket.title}".`,
          type: 'ticket_reply',
          ticket: ticket._id,
        })
      } catch (error) {
        console.error('Failed to create agent reply notification:', error)
      }
    }

    if (role === 'admin') {
      try {
        await createNotification({
          recipient: ticket.customer,
          title: 'Admin replied',
          message: `An admin replied to your ticket "${ticket.title}".`,
          type: 'ticket_reply',
          ticket: ticket._id,
        })
      } catch (error) {
        console.error('Failed to create customer notification for admin reply:', error)
      }

      if (ticket.assignedAgent) {
        try {
          await createNotification({
            recipient: ticket.assignedAgent,
            title: 'Admin replied',
            message: `An admin replied to the ticket "${ticket.title}".`,
            type: 'ticket_reply',
            ticket: ticket._id,
          })
        } catch (error) {
          console.error('Failed to create agent notification for admin reply:', error)
        }
      }
    }

    await comment.populate('author', 'name email')

    return res.status(201).json({
      message: 'Comment added successfully.',
      comment,
    })
  } catch {
    return res.status(500).json({ message: 'An unexpected error occurred.' })
  }
}

async function getComments(req, res) {
  const ticketId = req.params.id

  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    return res.status(400).json({ message: 'Invalid ticket ID.' })
  }

  try {
    const ticket = await Ticket.findById(ticketId)

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found.' })
    }

    const { id, role } = req.user || {}
    const isCustomerOwner = role === 'customer' && ticket.customer.toString() === id
    const isAssignedAgent =
      role === 'agent' && ticket.assignedAgent?.toString() === id

    if (!isCustomerOwner && !isAssignedAgent && role !== 'admin') {
      return res.status(403).json({ message: 'You are not authorized to view these comments.' })
    }

    const comments = await Comment.find({ ticket: ticketId })
      .populate('author', 'name email')
      .sort({ createdAt: 1 })

    return res.status(200).json({
      message: 'Comments retrieved successfully.',
      comments,
    })
  } catch {
    return res.status(500).json({ message: 'An unexpected error occurred.' })
  }
}

async function deleteTicket(req, res) {
  const ticketId = req.params.id

  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    return res.status(400).json({ message: 'Invalid ticket ID.' })
  }

  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Only admins can delete tickets.' })
  }

  try {
    const ticket = await Ticket.findById(ticketId)

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found.' })
    }

    await ticket.deleteOne()
    await Comment.deleteMany({ ticket: ticketId })

    return res.status(200).json({ message: 'Ticket deleted successfully.' })
  } catch {
    return res.status(500).json({ message: 'An unexpected error occurred.' })
  }
}

module.exports = {
  createTicket,
  getTickets,
  getTicketById,
  updateTicketStatus,
  assignTicket,
  addComment,
  getComments,
  deleteTicket,
}
