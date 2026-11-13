const jwt = require('jsonwebtoken')

async function protect(req, res, next) {
  const authorizationHeader = req.headers.authorization
  const bearerMatch =
    typeof authorizationHeader === 'string'
      ? /^Bearer\s+(\S+)$/i.exec(authorizationHeader)
      : null

  if (!bearerMatch) {
    return res.status(401).json({ message: 'A valid Bearer token is required.' })
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: 'Server configuration error.' })
  }

  try {
    req.user = jwt.verify(bearerMatch[1], process.env.JWT_SECRET)
    return next()
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' })
  }
}

module.exports = { protect }
