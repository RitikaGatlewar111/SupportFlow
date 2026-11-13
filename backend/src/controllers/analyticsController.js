const Ticket = require('../models/Ticket')
const User = require('../models/User')

const ticketStatuses = ['open', 'in_progress', 'resolved', 'closed']
const ticketPriorities = ['low', 'medium', 'high', 'urgent']
const ticketCategories = ['technical', 'billing', 'account', 'general']

async function getTicketStatusAnalytics(req, res) {
  try {
    const counts = await Ticket.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ])
    const countByStatus = new Map(counts.map(({ _id, count }) => [_id, count]))
    const data = Object.fromEntries(
      ticketStatuses.map((status) => [status, countByStatus.get(status) || 0]),
    )

    return res.status(200).json({
      message: 'Ticket status analytics retrieved successfully.',
      data,
    })
  } catch {
    return res.status(500).json({ message: 'An unexpected error occurred.' })
  }
}

async function getTicketPriorityAnalytics(req, res) {
  try {
    const counts = await Ticket.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ])
    const countByPriority = new Map(counts.map(({ _id, count }) => [_id, count]))
    const data = Object.fromEntries(
      ticketPriorities.map((priority) => [priority, countByPriority.get(priority) || 0]),
    )

    return res.status(200).json({
      message: 'Ticket priority analytics retrieved successfully.',
      data,
    })
  } catch {
    return res.status(500).json({ message: 'An unexpected error occurred.' })
  }
}

async function getTicketCategoryAnalytics(req, res) {
  try {
    const counts = await Ticket.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ])
    const countByCategory = new Map(counts.map(({ _id, count }) => [_id, count]))
    const data = Object.fromEntries(
      ticketCategories.map((category) => [category, countByCategory.get(category) || 0]),
    )

    return res.status(200).json({
      message: 'Ticket category analytics retrieved successfully.',
      data,
    })
  } catch {
    return res.status(500).json({ message: 'An unexpected error occurred.' })
  }
}

async function getTicketTrends(req, res) {
  const granularity = req.query?.granularity || 'day'

  if (!['day', 'month'].includes(granularity)) {
    return res.status(400).json({ message: 'Granularity must be day or month.' })
  }

  const dateFormat = granularity === 'month' ? '%Y-%m' : '%Y-%m-%d'

  try {
    const data = await Ticket.aggregate([
      {
        $group: {
          _id: {
            $dateToString: {
              format: dateFormat,
              date: '$createdAt',
              timezone: 'UTC',
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: '$_id', count: 1 } },
    ])

    return res.status(200).json({
      message: `Ticket creation trends by ${granularity} retrieved successfully.`,
      data,
    })
  } catch {
    return res.status(500).json({ message: 'An unexpected error occurred.' })
  }
}

async function getAgentAnalytics(req, res) {
  try {
    const [agents, assignedCounts] = await Promise.all([
      User.find({ role: 'agent' }).select('_id name').lean(),
      Ticket.aggregate([
        { $match: { assignedAgent: { $ne: null } } },
        {
          $group: {
            _id: '$assignedAgent',
            assignedCount: { $sum: 1 },
            resolvedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] },
            },
          },
        },
      ]),
    ])

    const countsByAgentId = new Map(
      assignedCounts.map((entry) => [String(entry._id), entry]),
    )
    const data = agents.map((agent) => {
      const counts = countsByAgentId.get(String(agent._id))

      return {
        agentId: agent._id,
        name: agent.name,
        assignedCount: counts?.assignedCount || 0,
        resolvedCount: counts?.resolvedCount || 0,
      }
    })

    return res.status(200).json({
      message: 'Current assigned-ticket analytics retrieved successfully.',
      data,
    })
  } catch {
    return res.status(500).json({ message: 'An unexpected error occurred.' })
  }
}

module.exports = {
  getTicketStatusAnalytics,
  getTicketPriorityAnalytics,
  getTicketCategoryAnalytics,
  getTicketTrends,
  getAgentAnalytics,
}
