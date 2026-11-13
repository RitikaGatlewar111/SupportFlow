const Notification = require('../models/Notification')

async function getNotifications(req, res) {
  try {
    const recipient = req.user.id
    const notifications = await Notification.find({ recipient }).sort({ createdAt: -1 })
    const unreadCount = await Notification.countDocuments({ recipient, isRead: false })

    return res.status(200).json({
      message: 'Notifications retrieved successfully.',
      notifications,
      unreadCount,
    })
  } catch {
    return res.status(500).json({ message: 'An unexpected error occurred.' })
  }
}

async function markNotificationAsRead(req, res) {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.id },
      { $set: { isRead: true } },
      { new: true, runValidators: true },
    )

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found.' })
    }

    return res.status(200).json({
      message: 'Notification marked as read.',
      notification,
    })
  } catch {
    return res.status(500).json({ message: 'An unexpected error occurred.' })
  }
}

async function markAllNotificationsAsRead(req, res) {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user.id, isRead: false },
      { $set: { isRead: true } },
    )

    return res.status(200).json({
      message: 'All notifications marked as read.',
      modifiedCount: result.modifiedCount,
    })
  } catch {
    return res.status(500).json({ message: 'An unexpected error occurred.' })
  }
}

module.exports = {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
}
