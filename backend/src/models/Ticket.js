const mongoose = require('mongoose')

const aiSuggestionsSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ['technical', 'billing', 'account', 'general'],
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
    },
    sentiment: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
    },
  },
  { _id: false },
)

const ticketSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['technical', 'billing', 'account', 'general'],
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    sentiment: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
    },
    aiSuggestions: {
      type: aiSuggestionsSchema,
      required: false,
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'closed'],
      default: 'open',
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true },
)

ticketSchema.index({ customer: 1 })
ticketSchema.index({ assignedAgent: 1 })
ticketSchema.index({ status: 1 })
ticketSchema.index({ createdAt: 1 })

module.exports = mongoose.model('Ticket', ticketSchema)
