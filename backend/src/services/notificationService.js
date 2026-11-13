const Notification = require('../models/Notification')

async function createNotification({ recipient, title, message, type, ticket }) {
  return Notification.create({
    recipient,
    title,
    message,
    type,
    ticket,
  })
}

module.exports = { createNotification }
