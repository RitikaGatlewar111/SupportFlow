const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const User = require('../models/User')

async function register(req, res) {
  const { name, email, password } = req.body || {}

  if (
    typeof name !== 'string' ||
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    !name.trim() ||
    !email.trim() ||
    !password
  ) {
    return res.status(400).json({
      message: 'Name, email, and password are required.',
    })
  }

  const trimmedName = name.trim()
  const normalizedEmail = email.trim().toLowerCase()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ message: 'Please provide a valid email address.' })
  }

  if (password.length < 8) {
    return res.status(400).json({
      message: 'Password must be at least 8 characters long.',
    })
  }

  try {
    const existingUser = await User.findOne({ email: normalizedEmail })

    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists.' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await User.create({
      name: trimmedName,
      email: normalizedEmail,
      password: hashedPassword,
    })

    return res.status(201).json({
      message: 'Registration successful.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    })
  } catch {
    return res.status(500).json({ message: 'An unexpected error occurred.' })
  }
}

async function login(req, res) {
  const { email, password } = req.body || {}

  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    !email.trim() ||
    !password.trim()
  ) {
    return res.status(400).json({
      message: 'Email and password are required.',
    })
  }

  const normalizedEmail = email.trim().toLowerCase()

  try {
    const user = await User.findOne({ email: normalizedEmail })

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' })
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'This account has been disabled.' })
    }

    const passwordMatches = await bcrypt.compare(password, user.password)

    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password.' })
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'Server configuration error.' })
    }

    const token = jwt.sign(
      { id: user._id.toString(), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' },
    )

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    })
  } catch {
    return res.status(500).json({ message: 'An unexpected error occurred.' })
  }
}

async function getMe(req, res) {
  try {
    const user = await User.findById(req.user.id).select('name email role createdAt')

    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    return res.status(200).json({
      message: 'User retrieved successfully.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    })
  } catch {
    return res.status(500).json({ message: 'An unexpected error occurred.' })
  }
}

async function getAllUsers(req, res) {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })

    return res.status(200).json({
      message: 'Users retrieved successfully.',
      users: users.map((user) => ({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      })),
    })
  } catch {
    return res.status(500).json({ message: 'An unexpected error occurred.' })
  }
}

async function updateUserStatus(req, res) {
  const targetUserId = req.params.id
  const { isActive } = req.body || {}

  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    return res.status(400).json({ message: 'Invalid user ID.' })
  }

  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ message: 'isActive must be a boolean.' })
  }

  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Only admins can update user status.' })
  }

  if (targetUserId.toLowerCase() === String(req.user.id).toLowerCase()) {
    return res.status(400).json({ message: 'Admins cannot change their own account status.' })
  }

  try {
    const user = await User.findById(targetUserId)

    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    user.isActive = isActive
    await user.save()

    return res.status(200).json({
      message: 'User status updated successfully.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    })
  } catch {
    return res.status(500).json({ message: 'An unexpected error occurred.' })
  }
}

module.exports = { register, login, getMe, getAllUsers, updateUserStatus }
