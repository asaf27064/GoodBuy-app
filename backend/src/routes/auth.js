const express = require('express')
const bcrypt = require('bcrypt')
const { body, validationResult } = require('express-validator')
const User = require('../models/userModel')
const {
  generateAccessToken,
  generateRefreshToken,
  verifyToken
} = require('../utils/tokenService')
const auth = require('../middleware/auth')

const router = express.Router()

// Validation chains
const validateRegister = [
  body('email')
    .isEmail().withMessage('כתובת אימייל אינה תקינה'),
  body('username')
    .isLength({ min: 3, max: 20 }).withMessage('שם משתמש חייב להכיל 3–20 תווים')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('שם משתמש — רק אותיות, ספרות וקו תחתון'),
  body('password')
    .isLength({ min: 8 }).withMessage('הסיסמה חייבת להכיל לפחות 8 תווים')
    .matches(/[a-z]/).withMessage('הסיסמה חייבת להכיל אות קטנה')
    .matches(/[A-Z]/).withMessage('הסיסמה חייבת להכיל אות גדולה')
    .matches(/[0-9]/).withMessage('הסיסמה חייבת להכיל ספרה')
    .matches(/[^A-Za-z0-9]/).withMessage('הסיסמה חייבת להכיל תו מיוחד'),
  (req, res, next) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }
    next()
  }
]

const validateLogin = [
  body('username').notEmpty().withMessage('שם משתמש הינו שדה חובה'),
  body('password').notEmpty().withMessage('סיסמה הינה שדה חובה'),
  (req, res, next) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }
    next()
  }
]

// POST /auth/register
router.post(
  '/register',
  validateRegister,
  async (req, res) => {
    try {
      const { email, username, password } = req.body

      // duplicate check
      if (await User.findOne({ $or: [{ email }, { username }] })) {
        return res
          .status(409)
          .json({ message: 'המייל או שם המשתמש כבר בשימוש.' })
      }

      const passwordHash = await bcrypt.hash(password, 12)
      await User.create({ email, username, passwordHash })

      return res
        .status(201)
        .json({ message: 'נרשמת בהצלחה! כעת תוכל להתחבר.' })

    } catch (err) {
      console.error('Register error:', err)
      return res
        .status(500)
        .json({ message: 'אירעה שגיאת שרת, נסה שוב מאוחר יותר.' })
    }
  }
)

// POST /auth/login
router.post(
  '/login',
  validateLogin,
  async (req, res) => {
    try {
      const { username, password } = req.body
      const user = await User.findOne({ username })

      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res
          .status(401)
          .json({ message: 'שם המשתמש או הסיסמה שגויים.' })
      }

      const accessToken = generateAccessToken(user.id)
      const refreshToken = generateRefreshToken(user.id)
      user.refreshToken = refreshToken
      await user.save()

      return res.json({ accessToken, refreshToken })
    } catch (err) {
      console.error('Login error:', err)
      return res
        .status(500)
        .json({ message: 'אירעה שגיאת שרת, נסה שוב מאוחר יותר.' })
    }
  }
)

// POST /auth/refresh
// Rotates the refresh token on every use. Old token becomes invalid immediately,
// so a leaked token can be used at most once. Existing mobile code is backwards
// compatible: it stores `data.accessToken`, and now optionally `data.refreshToken`.
router.post(
  '/refresh',
  async (req, res) => {
    const { refreshToken } = req.body
    if (!refreshToken) {
      return res
        .status(401)
        .json({ message: 'Refresh token חסר.' })
    }

    try {
      const payload = verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET)
      const user = await User.findById(payload.sub)

      if (!user || user.refreshToken !== refreshToken) {
        // Reuse of an invalidated token: hard-revoke the session as defense-in-depth
        if (user) { user.refreshToken = null; await user.save() }
        return res
          .status(403)
          .json({ message: 'Refresh token לא תקין.' })
      }

      const newAccessToken  = generateAccessToken(user.id)
      const newRefreshToken = generateRefreshToken(user.id)
      user.refreshToken = newRefreshToken
      await user.save()
      return res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken })
    } catch (err) {
      console.error('Refresh error:', err)
      return res
        .status(403)
        .json({ message: 'Refresh token פג או לא תקין.' })
    }
  }
)

// POST /auth/logout
router.post(
  '/logout',
  auth,
  async (req, res) => {
    try {
      req.user.refreshToken = null
      await req.user.save()
      return res.json({ message: 'התנתקת בהצלחה.' })
    } catch (err) {
      console.error('Logout error:', err)
      return res
        .status(500)
        .json({ message: 'אירעה שגיאת שרת, נסה שוב מאוחר יותר.' })
    }
  }
)

// GET /auth/me
router.get(
  '/me',
  auth,
  (req, res) => {
    const { _id, email, username, location, createdAt } = req.user
    return res.json({
      user: { id: _id, email, username, location, createdAt }
    })
  }
)

module.exports = router
