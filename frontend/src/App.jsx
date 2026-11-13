import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'

const dashboardPaths = {
  customer: '/dashboard',
  agent: '/agent/dashboard',
  admin: '/admin/dashboard',
}

const protectedDashboardPaths = Object.values(dashboardPaths)

function getDashboardPath(role) {
  return dashboardPaths[role] || null
}

function hasAuthToken() {
  try {
    return Boolean(window.localStorage.getItem('token'))
  } catch {
    return false
  }
}

function getCurrentPage() {
  if (window.location.pathname === '/register') {
    return 'register'
  }

  if (protectedDashboardPaths.includes(window.location.pathname)) {
    if (!hasAuthToken()) {
      window.history.replaceState({}, '', '/login')
      return 'login'
    }

    return 'dashboard'
  }

  return 'login'
}

function getStoredUser() {
  try {
    const storedUser = window.localStorage.getItem('user')
    return storedUser ? JSON.parse(storedUser) : null
  } catch {
    return null
  }
}

function getUserInitials(name) {
  if (!name) {
    return 'C'
  }

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path
          d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7a2.5 2.5 0 0 1-2.5 2.5h-4l-4 3v-3.1a2.5 2.5 0 0 1-3.5-2.4v-7Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M8.5 8.5h7M8.5 11.5h4.5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}

function PasswordField({ id, label, showPassword, onToggle, autoComplete }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-input">
        <input
          id={id}
          name={id}
          type={showPassword ? 'text' : 'password'}
          placeholder="At least 8 characters"
          autoComplete={autoComplete}
          minLength={8}
          required
        />
        <button
          className="password-toggle"
          type="button"
          onClick={onToggle}
          aria-label={showPassword ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {showPassword ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  )
}

function NotificationCenter({ onOpenTicket, onUnauthorized }) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [markingNotificationId, setMarkingNotificationId] = useState(null)
  const [isMarkingAll, setIsMarkingAll] = useState(false)
  const containerRef = useRef(null)
  const requestId = useRef(0)
  const onUnauthorizedRef = useRef(onUnauthorized)
  onUnauthorizedRef.current = onUnauthorized

  const loadNotifications = useCallback(async () => {
    const request = ++requestId.current
    let token

    try {
      token = window.localStorage.getItem('token')
    } catch {
      token = null
    }

    if (!token) {
      setStatus('error')
      setError('Your session has expired. Please sign in again.')
      return
    }

    setStatus('loading')
    setError('')

    try {
      const response = await fetch('http://localhost:5000/api/notifications', {
        headers: { Authorization: ['Bearer', token].join(' ') },
      })

      let result
      try {
        result = await response.json()
      } catch {
        result = null
      }

      if (response.status === 401 || response.status === 403) {
        onUnauthorizedRef.current()
        return
      }

      if (!response.ok || !Array.isArray(result?.notifications)) {
        throw new Error(result?.message || 'Unable to load notifications.')
      }

      if (request === requestId.current) {
        setNotifications(result.notifications)
        setUnreadCount(
          Number.isInteger(result.unreadCount)
            ? result.unreadCount
            : result.notifications.filter((notification) => !notification.isRead).length,
        )
        setStatus('ready')
      }
    } catch {
      if (request === requestId.current) {
        setError('Unable to load notifications. Please try again.')
        setStatus('error')
      }
    }
  }, [])

  useEffect(() => {
    void loadNotifications()
    return () => {
      requestId.current += 1
    }
  }, [loadNotifications])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  async function handleNotificationClick(notification) {
    const notificationId = String(notification._id)
    if (markingNotificationId || isMarkingAll) {
      return
    }

    setMarkingNotificationId(notificationId)
    setError('')
    let token

    try {
      token = window.localStorage.getItem('token')
      if (!token) {
        throw new Error('Your session has expired. Please sign in again.')
      }

      const response = await fetch(
        `http://localhost:5000/api/notifications/${encodeURIComponent(notificationId)}/read`,
        {
          method: 'PATCH',
          headers: { Authorization: ['Bearer', token].join(' ') },
        },
      )

      let result
      try {
        result = await response.json()
      } catch {
        result = null
      }

      if (response.status === 401 || response.status === 403) {
        onUnauthorizedRef.current()
        return
      }

      if (!response.ok || !result?.notification) {
        throw new Error(result?.message || 'Unable to update this notification.')
      }

      setNotifications((current) =>
        current.map((item) =>
          String(item._id) === notificationId ? result.notification : item,
        ),
      )
      setUnreadCount((count) =>
        notification.isRead ? count : Math.max(0, count - 1),
      )
      await loadNotifications()

      const ticketId =
        typeof notification.ticket === 'string'
          ? notification.ticket
          : notification.ticket?._id
      setIsOpen(false)
      if (ticketId) {
        onOpenTicket(String(ticketId))
      }
    } catch (requestError) {
      setError(
        requestError.message === 'Your session has expired. Please sign in again.'
          ? requestError.message
          : 'Unable to mark this notification as read. Please try again.',
      )
    } finally {
      setMarkingNotificationId(null)
    }
  }

  async function handleMarkAllAsRead() {
    if (isMarkingAll || markingNotificationId || unreadCount === 0) {
      return
    }

    setIsMarkingAll(true)
    setError('')

    try {
      let token
      try {
        token = window.localStorage.getItem('token')
      } catch {
        token = null
      }

      if (!token) {
        throw new Error('Your session has expired. Please sign in again.')
      }

      const response = await fetch('http://localhost:5000/api/notifications/read-all', {
        method: 'PATCH',
        headers: { Authorization: ['Bearer', token].join(' ') },
      })

      let result
      try {
        result = await response.json()
      } catch {
        result = null
      }

      if (response.status === 401 || response.status === 403) {
        onUnauthorizedRef.current()
        return
      }

      if (!response.ok) {
        throw new Error(result?.message || 'Unable to update notifications.')
      }

      setNotifications((current) =>
        current.map((notification) => ({ ...notification, isRead: true })),
      )
      setUnreadCount(0)
      await loadNotifications()
    } catch {
      setError('Unable to mark all notifications as read. Please try again.')
    } finally {
      setIsMarkingAll(false)
    }
  }

  return (
    <div className="notification-center" ref={containerRef}>
      <button
        className="notification-button"
        type="button"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title="Notifications"
        onClick={() => {
          const shouldOpen = !isOpen
          setIsOpen(shouldOpen)
          if (shouldOpen) {
            void loadNotifications()
          }
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="notification-count" aria-label={`${unreadCount} unread notifications`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <section className="notification-panel" role="dialog" aria-label="Notifications">
          <div className="notification-panel-header">
            <h2>Notifications</h2>
            <button
              className="notification-mark-all"
              type="button"
              onClick={handleMarkAllAsRead}
              disabled={unreadCount === 0 || isMarkingAll || Boolean(markingNotificationId)}
            >
              {isMarkingAll ? 'Marking…' : 'Mark all as read'}
            </button>
          </div>

          {status === 'loading' ? (
            <p className="notification-feedback" role="status">Loading notifications…</p>
          ) : error ? (
            <div className="notification-feedback notification-error" role="alert">
              <p>{error}</p>
              <button type="button" className="retry-button" onClick={() => void loadNotifications()}>
                Try again
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <p className="notification-feedback">You have no notifications.</p>
          ) : (
            <div className="notification-list">
              {notifications.map((notification) => {
                const notificationId = String(notification._id)
                const date = new Date(notification.createdAt)
                const dateLabel = Number.isNaN(date.getTime())
                  ? 'Date unavailable'
                  : date.toLocaleString()

                return (
                  <button
                    className={`notification-item${notification.isRead ? '' : ' is-unread'}`}
                    type="button"
                    key={notificationId}
                    onClick={() => void handleNotificationClick(notification)}
                    disabled={Boolean(markingNotificationId) || isMarkingAll}
                  >
                    <span className="notification-item-heading">
                      <strong>{notification.title}</strong>
                      {!notification.isRead && <span className="notification-unread-dot" aria-label="Unread" />}
                    </span>
                    <span className="notification-item-message">{notification.message}</span>
                    <time className="notification-item-date" dateTime={notification.createdAt}>
                      {dateLabel}
                    </time>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function AnalyticsHorizontalBarChart({ title, items, variant }) {
  const maxCount = Math.max(0, ...items.map((item) => item.count)) || 1

  return (
    <section className="analytics-card" aria-label={title}>
      <h3 className="analytics-card-title">{title}</h3>
      <div className="analytics-bars" role="list">
        {items.map((item) => (
          <div
            className="analytics-bar-row"
            key={item.key}
            role="listitem"
            aria-label={`${item.label}: ${item.count} tickets`}
          >
            <div className="analytics-bar-meta">
              <span>{item.label}</span>
              <strong>{item.count}</strong>
            </div>
            <div
              className="analytics-bar-track"
              role="meter"
              aria-label={`${item.label} tickets`}
              aria-valuemin={0}
              aria-valuemax={maxCount}
              aria-valuenow={item.count}
            >
              <span
                className={`analytics-bar-fill ${variant} ${variant === 'priority' ? `priority-${item.key}` : item.key}`}
                style={{ width: `${(item.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function AnalyticsTrendChart({ trends }) {
  const maxCount = Math.max(1, ...trends.map((trend) => Number(trend.count) || 0))

  return (
    <section className="analytics-card" aria-label="Daily ticket creation">
      <h3 className="analytics-card-title">Daily ticket creation</h3>
      {trends.length > 0 ? (
        <div className="analytics-trend-scroll" role="group" aria-label="Daily ticket counts">
          <div
            className="analytics-trend-chart"
            role="list"
            style={{ minWidth: `${Math.max(100, trends.length * 58)}px` }}
          >
            {trends.map((trend) => {
              const count = Number(trend.count) || 0
              const date = new Date(`${trend.date}T00:00:00Z`)
              const dateLabel = Number.isNaN(date.getTime())
                ? trend.date
                : date.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'UTC',
                  })

              return (
                <div
                  className="analytics-trend-column"
                  key={trend.date}
                  role="listitem"
                  aria-label={`${trend.date}: ${count} tickets`}
                >
                  <strong className="analytics-trend-value">{count}</strong>
                  <div className="analytics-trend-bar-track" aria-hidden="true">
                    <span
                      className="analytics-trend-bar"
                      style={{ height: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                  <time className="analytics-trend-date" dateTime={trend.date} title={trend.date}>
                    {dateLabel}
                  </time>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <p className="analytics-empty">No ticket creation data yet.</p>
      )}
    </section>
  )
}

function AnalyticsAgentChart({ agents }) {
  const maxCount =
    Math.max(
      0,
      ...agents.flatMap((agent) => [
        Number(agent.assignedCount) || 0,
        Number(agent.resolvedCount) || 0,
      ]),
    ) || 1

  return (
    <section className="analytics-card" aria-label="Agent assignments">
      <h3 className="analytics-card-title">Agent assignments</h3>
      {agents.length > 0 ? (
        <div className="analytics-agent-list" role="list">
          {agents.map((agent) => {
            const assignedCount = Number(agent.assignedCount) || 0
            const resolvedCount = Number(agent.resolvedCount) || 0

            return (
              <div
                className="analytics-agent-row"
                key={agent.agentId}
                role="listitem"
                aria-label={`${agent.name}: ${assignedCount} assigned, ${resolvedCount} resolved`}
              >
                <h4 className="analytics-agent-name" title={agent.name}>{agent.name}</h4>
                {[
                  { label: 'Assigned', count: assignedCount, type: 'assigned' },
                  { label: 'Resolved', count: resolvedCount, type: 'resolved' },
                ].map((metric) => (
                  <div className="analytics-agent-metric" key={metric.type}>
                    <div className="analytics-agent-meta">
                      <span>{metric.label}</span>
                      <strong>{metric.count}</strong>
                    </div>
                    <div
                      className="analytics-bar-track"
                      role="meter"
                      aria-label={`${agent.name} ${metric.label.toLowerCase()} tickets`}
                      aria-valuemin={0}
                      aria-valuemax={maxCount}
                      aria-valuenow={metric.count}
                    >
                      <span
                        className={`analytics-bar-fill ${metric.type}`}
                        style={{ width: `${(metric.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      ) : (
        <p className="analytics-empty">No agents found.</p>
      )}
    </section>
  )
}

function App() {
  const [page, setPage] = useState(getCurrentPage)
  const [locationPath, setLocationPath] = useState(window.location.pathname)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formMessage, setFormMessage] = useState(null)
  const [currentUser, setCurrentUser] = useState(getStoredUser)
  const [tickets, setTickets] = useState([])
  const [ticketsStatus, setTicketsStatus] = useState('idle')
  const [ticketsAttempt, setTicketsAttempt] = useState(0)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerSearchQuery, setCustomerSearchQuery] = useState('')
  const [customerStatusFilter, setCustomerStatusFilter] = useState('')
  const [customerPriorityFilter, setCustomerPriorityFilter] = useState('')
  const [customerCategoryFilter, setCustomerCategoryFilter] = useState('')
  const [customerSort, setCustomerSort] = useState('newest')
  const [filteredCustomerTickets, setFilteredCustomerTickets] = useState([])
  const [filteredCustomerTicketsStatus, setFilteredCustomerTicketsStatus] = useState('idle')
  const [filteredCustomerTicketsAttempt, setFilteredCustomerTicketsAttempt] = useState(0)
  const [agentSearch, setAgentSearch] = useState('')
  const [agentSearchQuery, setAgentSearchQuery] = useState('')
  const [agentStatusFilter, setAgentStatusFilter] = useState('')
  const [agentPriorityFilter, setAgentPriorityFilter] = useState('')
  const [agentCategoryFilter, setAgentCategoryFilter] = useState('')
  const [agentSort, setAgentSort] = useState('newest')
  const [filteredAgentTickets, setFilteredAgentTickets] = useState([])
  const [filteredAgentTicketsStatus, setFilteredAgentTicketsStatus] = useState('idle')
  const [filteredAgentTicketsAttempt, setFilteredAgentTicketsAttempt] = useState(0)
  const [adminTickets, setAdminTickets] = useState([])
  const [adminUsers, setAdminUsers] = useState([])
  const [adminDataStatus, setAdminDataStatus] = useState('idle')
  const [adminDataAttempt, setAdminDataAttempt] = useState(0)
  const [adminStatusAnalytics, setAdminStatusAnalytics] = useState({})
  const [adminPriorityAnalytics, setAdminPriorityAnalytics] = useState({})
  const [adminCategoryAnalytics, setAdminCategoryAnalytics] = useState({})
  const [adminDailyTicketTrends, setAdminDailyTicketTrends] = useState([])
  const [adminAgentAnalytics, setAdminAgentAnalytics] = useState([])
  const [adminAnalyticsStatus, setAdminAnalyticsStatus] = useState('idle')
  const [adminAnalyticsError, setAdminAnalyticsError] = useState('')
  const [adminAnalyticsAttempt, setAdminAnalyticsAttempt] = useState(0)
  const [adminSearch, setAdminSearch] = useState('')
  const [adminSearchQuery, setAdminSearchQuery] = useState('')
  const [adminStatusFilter, setAdminStatusFilter] = useState('')
  const [adminPriorityFilter, setAdminPriorityFilter] = useState('')
  const [adminCategoryFilter, setAdminCategoryFilter] = useState('')
  const [adminSort, setAdminSort] = useState('newest')
  const [filteredAdminTickets, setFilteredAdminTickets] = useState([])
  const [filteredAdminTicketsStatus, setFilteredAdminTicketsStatus] = useState('idle')
  const [filteredAdminTicketsAttempt, setFilteredAdminTicketsAttempt] = useState(0)
  const [updatingAgentStatusId, setUpdatingAgentStatusId] = useState(null)
  const [agentStatusMessage, setAgentStatusMessage] = useState(null)
  const [assigningTicketId, setAssigningTicketId] = useState(null)
  const [assignmentMessage, setAssignmentMessage] = useState(null)
  const [selectedAdminTicketId, setSelectedAdminTicketId] = useState(null)
  const [adminTicketDetails, setAdminTicketDetails] = useState(null)
  const [adminTicketDetailsStatus, setAdminTicketDetailsStatus] = useState('idle')
  const [adminTicketDetailsAttempt, setAdminTicketDetailsAttempt] = useState(0)
  const [adminTicketComments, setAdminTicketComments] = useState([])
  const [adminTicketCommentsStatus, setAdminTicketCommentsStatus] = useState('idle')
  const [adminTicketCommentsAttempt, setAdminTicketCommentsAttempt] = useState(0)
  const [adminAssignmentSelection, setAdminAssignmentSelection] = useState('')
  const [adminAssignmentMessage, setAdminAssignmentMessage] = useState(null)
  const [isAdminAssigningTicket, setIsAdminAssigningTicket] = useState(false)
  const [adminStatusSelection, setAdminStatusSelection] = useState('')
  const [adminStatusMessage, setAdminStatusMessage] = useState(null)
  const [isAdminUpdatingStatus, setIsAdminUpdatingStatus] = useState(false)
  const [selectedAgentTicketId, setSelectedAgentTicketId] = useState(null)
  const [agentTicketDetails, setAgentTicketDetails] = useState(null)
  const [agentTicketDetailsStatus, setAgentTicketDetailsStatus] = useState('idle')
  const [agentTicketDetailsAttempt, setAgentTicketDetailsAttempt] = useState(0)
  const [agentTicketStatusSelection, setAgentTicketStatusSelection] = useState('')
  const [isUpdatingAgentTicketStatus, setIsUpdatingAgentTicketStatus] = useState(false)
  const [agentTicketStatusMessage, setAgentTicketStatusMessage] = useState(null)
  const [agentComments, setAgentComments] = useState([])
  const [agentCommentsStatus, setAgentCommentsStatus] = useState('idle')
  const [agentCommentsAttempt, setAgentCommentsAttempt] = useState(0)
  const [agentCommentDraft, setAgentCommentDraft] = useState('')
  const [isSendingAgentComment, setIsSendingAgentComment] = useState(false)
  const [agentCommentMessage, setAgentCommentMessage] = useState(null)
  const [selectedCustomerTicketId, setSelectedCustomerTicketId] = useState(null)
  const [customerTicketDetails, setCustomerTicketDetails] = useState(null)
  const [customerTicketDetailsStatus, setCustomerTicketDetailsStatus] = useState('idle')
  const [customerTicketDetailsAttempt, setCustomerTicketDetailsAttempt] = useState(0)
  const [customerComments, setCustomerComments] = useState([])
  const [customerCommentsStatus, setCustomerCommentsStatus] = useState('idle')
  const [customerCommentsAttempt, setCustomerCommentsAttempt] = useState(0)
  const [customerCommentDraft, setCustomerCommentDraft] = useState('')
  const [isSendingCustomerComment, setIsSendingCustomerComment] = useState(false)
  const [customerCommentMessage, setCustomerCommentMessage] = useState(null)
  const [isTicketFormOpen, setIsTicketFormOpen] = useState(false)
  const [isCreatingTicket, setIsCreatingTicket] = useState(false)
  const [ticketMessage, setTicketMessage] = useState(null)
  const [dashboardStatus, setDashboardStatus] = useState(
    () => (getCurrentPage() === 'dashboard' ? 'loading' : 'idle'),
  )
  const [verificationAttempt, setVerificationAttempt] = useState(0)
  const verificationRequest = useRef(null)
  const ticketsRequest = useRef(null)
  const filteredCustomerTicketsRequest = useRef(null)
  const filteredAgentTicketsRequest = useRef(null)
  const adminDataRequest = useRef(null)
  const filteredAdminTicketsRequest = useRef(null)
  const adminTicketDetailsRequest = useRef(null)
  const adminTicketCommentsRequest = useRef(null)
  const agentTicketDetailsRequest = useRef(null)
  const agentCommentsRequest = useRef(null)
  const customerTicketDetailsRequest = useRef(null)
  const customerCommentsRequest = useRef(null)
  const assignmentInProgress = useRef(false)
  const agentStatusUpdateInProgress = useRef(false)
  const adminAssignmentInProgress = useRef(false)
  const adminStatusUpdateInProgress = useRef(false)
  const ticketStatusUpdateInProgress = useRef(false)
  const agentCommentInProgress = useRef(false)
  const customerCommentInProgress = useRef(false)
  const isRegister = page === 'register'
  const ticketStats = [
    { label: 'Total Tickets', count: tickets.length, className: 'total' },
    {
      label: 'Open Tickets',
      count: tickets.filter((ticket) => ticket.status === 'open').length,
      className: 'open',
    },
    {
      label: 'In Progress',
      count: tickets.filter((ticket) => ticket.status === 'in_progress').length,
      className: 'progress',
    },
    {
      label: 'Resolved',
      count: tickets.filter((ticket) => ticket.status === 'resolved').length,
      className: 'resolved',
    },
  ]

  useEffect(() => {
    function handlePopState() {
      setLocationPath(window.location.pathname)
      setPage(getCurrentPage())
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (page !== 'dashboard' || !protectedDashboardPaths.includes(locationPath)) {
      return
    }

    let token

    try {
      token = window.localStorage.getItem('token')
    } catch {
      token = null
    }

    if (!token) {
      window.localStorage.removeItem('token')
      window.localStorage.removeItem('user')
      window.history.replaceState({}, '', '/login')
      setLocationPath('/login')
      setCurrentUser(null)
      setPage('login')
      return
    }

    let isCurrent = true
    setDashboardStatus('loading')
    setFormMessage(null)

    let request = verificationRequest.current

    if (!request || request.token !== token) {
      const promise = fetch('http://localhost:5000/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).then(async (response) => {
        if (response.status === 401 || response.status === 403) {
          return { type: 'unauthorized' }
        }

        let result = null

        try {
          result = await response.json()
        } catch {
          return { type: 'error' }
        }

        if (!response.ok || !result?.user || typeof result.user !== 'object') {
          return { type: 'error' }
        }

        return { type: 'success', user: result.user }
      }).catch(() => ({ type: 'error' }))

      request = { token, promise }
      verificationRequest.current = request
    }

    request.promise.then((result) => {
      if (!isCurrent) {
        return
      }

      if (verificationRequest.current === request && result.type !== 'success') {
        verificationRequest.current = null
      }

      if (result.type === 'unauthorized') {
        window.localStorage.removeItem('token')
        window.localStorage.removeItem('user')
        window.history.replaceState({}, '', '/login')
        setLocationPath('/login')
        setCurrentUser(null)
        setFormMessage({ type: 'error', text: 'Your session has expired. Please sign in again.' })
        setDashboardStatus('idle')
        setPage('login')
        return
      }

      if (result.type === 'error') {
        verificationRequest.current = null
        setDashboardStatus('error')
        setFormMessage({
          type: 'error',
          text: 'Unable to verify your session. Check your connection and try again.',
        })
        return
      }

      const actualDashboardPath = getDashboardPath(result.user.role)

      if (!actualDashboardPath) {
        window.localStorage.removeItem('token')
        window.localStorage.removeItem('user')
        window.history.replaceState({}, '', '/login')
        setLocationPath('/login')
        setCurrentUser(null)
        setFormMessage({ type: 'error', text: 'Your account role is not supported.' })
        setDashboardStatus('idle')
        setPage('login')
        return
      }

      try {
        window.localStorage.setItem('user', JSON.stringify(result.user))
      } catch {
        setDashboardStatus('error')
        setFormMessage({
          type: 'error',
          text: 'Unable to load your account. Please try again.',
        })
        return
      }

      setCurrentUser(result.user)
      setDashboardStatus('ready')

      if (window.location.pathname !== actualDashboardPath) {
        window.history.replaceState({}, '', actualDashboardPath)
        setLocationPath(actualDashboardPath)
      }
    })

    return () => {
      isCurrent = false
    }
  }, [page, locationPath, verificationAttempt])

  useEffect(() => {
    if (
      page !== 'dashboard' ||
      locationPath !== dashboardPaths[currentUser?.role] ||
      dashboardStatus !== 'ready' ||
      !['customer', 'agent'].includes(currentUser?.role)
    ) {
      return
    }

    let token

    try {
      token = window.localStorage.getItem('token')
    } catch {
      token = null
    }

    if (!token) {
      return
    }

    let isCurrent = true
    setTicketsStatus('loading')

    let request = ticketsRequest.current

    if (!request || request.token !== token) {
      const promise = fetch('http://localhost:5000/api/tickets', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).then(async (response) => {
        if (response.status === 401 || response.status === 403) {
          return { type: 'unauthorized' }
        }

        let result

        try {
          result = await response.json()
        } catch {
          return { type: 'error' }
        }

        if (!response.ok || !Array.isArray(result?.tickets)) {
          return { type: 'error' }
        }

        return { type: 'success', tickets: result.tickets }
      }).catch(() => ({ type: 'error' }))

      request = { token, promise }
      ticketsRequest.current = request
    }

    request.promise.then((result) => {
      if (!isCurrent) {
        return
      }

      if (result.type !== 'success' && ticketsRequest.current === request) {
        ticketsRequest.current = null
      }

      if (result.type === 'unauthorized') {
        window.localStorage.removeItem('token')
        window.localStorage.removeItem('user')
        window.history.replaceState({}, '', '/login')
        setLocationPath('/login')
        setCurrentUser(null)
        setTickets([])
        setTicketsStatus('idle')
        setDashboardStatus('idle')
        setFormMessage({ type: 'error', text: 'Your session has expired. Please sign in again.' })
        setPage('login')
        return
      }

      if (result.type === 'error') {
        setTicketsStatus('error')
        return
      }

      setTickets(result.tickets)
      setTicketsStatus('ready')
    })

    return () => {
      isCurrent = false
    }
  }, [page, locationPath, dashboardStatus, currentUser?.role, ticketsAttempt])

  useEffect(() => {
    const search = customerSearchQuery.trim()
    const hasFilters = Boolean(
      search ||
      customerStatusFilter ||
      customerPriorityFilter ||
      customerCategoryFilter ||
      customerSort === 'oldest',
    )

    if (
      page !== 'dashboard' ||
      locationPath !== dashboardPaths.customer ||
      dashboardStatus !== 'ready' ||
      currentUser?.role !== 'customer' ||
      selectedCustomerTicketId ||
      ticketsStatus !== 'ready' ||
      !hasFilters
    ) {
      setFilteredCustomerTicketsStatus('idle')
      return
    }

    if (tickets.length === 0) {
      setFilteredCustomerTickets([])
      setFilteredCustomerTicketsStatus('ready')
      return
    }

    let token

    try {
      token = window.localStorage.getItem('token')
    } catch {
      token = null
    }

    if (!token) {
      return
    }

    const searchParams = new URLSearchParams()
    if (search) searchParams.set('search', search)
    if (customerStatusFilter) searchParams.set('status', customerStatusFilter)
    if (customerPriorityFilter) searchParams.set('priority', customerPriorityFilter)
    if (customerCategoryFilter) searchParams.set('category', customerCategoryFilter)
    searchParams.set('sort', customerSort)
    const queryString = searchParams.toString()

    let isCurrent = true
    setFilteredCustomerTicketsStatus('loading')

    let request = filteredCustomerTicketsRequest.current

    if (!request || request.token !== token || request.query !== queryString) {
      const promise = fetch(`http://localhost:5000/api/tickets?${queryString}`, {
        headers: {
          Authorization: ['Bearer', token].join(' '),
        },
      }).then(async (response) => {
        if (response.status === 401 || response.status === 403) {
          return { type: 'unauthorized' }
        }

        let result

        try {
          result = await response.json()
        } catch {
          return { type: 'error' }
        }

        if (!response.ok || !Array.isArray(result?.tickets)) {
          return { type: 'error' }
        }

        return { type: 'success', tickets: result.tickets }
      }).catch(() => ({ type: 'error' }))

      request = { token, query: queryString, promise }
      filteredCustomerTicketsRequest.current = request
    }

    request.promise.then((result) => {
      if (!isCurrent) {
        return
      }

      if (filteredCustomerTicketsRequest.current === request) {
        filteredCustomerTicketsRequest.current = null
      }

      if (result.type === 'unauthorized') {
        window.localStorage.removeItem('token')
        window.localStorage.removeItem('user')
        window.history.replaceState({}, '', '/login')
        setLocationPath('/login')
        setCurrentUser(null)
        setTickets([])
        setFilteredCustomerTickets([])
        setFilteredCustomerTicketsStatus('idle')
        setTicketsStatus('idle')
        setDashboardStatus('idle')
        setFormMessage({ type: 'error', text: 'Your session has expired. Please sign in again.' })
        setPage('login')
        return
      }

      if (result.type === 'error') {
        setFilteredCustomerTicketsStatus('error')
        return
      }

      setFilteredCustomerTickets(result.tickets)
      setFilteredCustomerTicketsStatus('ready')
    })

    return () => {
      isCurrent = false
    }
  }, [
    page,
    locationPath,
    dashboardStatus,
    currentUser?.role,
    ticketsStatus,
    tickets,
    selectedCustomerTicketId,
    customerSearchQuery,
    customerStatusFilter,
    customerPriorityFilter,
    customerCategoryFilter,
    customerSort,
    filteredCustomerTicketsAttempt,
  ])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setCustomerSearchQuery(customerSearch.trim())
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [customerSearch])

  useEffect(() => {
    const search = agentSearchQuery.trim()
    const hasFilters = Boolean(
      search ||
      agentStatusFilter ||
      agentPriorityFilter ||
      agentCategoryFilter ||
      agentSort === 'oldest',
    )

    if (
      page !== 'dashboard' ||
      locationPath !== dashboardPaths.agent ||
      dashboardStatus !== 'ready' ||
      currentUser?.role !== 'agent' ||
      selectedAgentTicketId ||
      ticketsStatus !== 'ready' ||
      !hasFilters
    ) {
      setFilteredAgentTicketsStatus('idle')
      return
    }

    if (tickets.length === 0) {
      setFilteredAgentTickets([])
      setFilteredAgentTicketsStatus('ready')
      return
    }

    let token

    try {
      token = window.localStorage.getItem('token')
    } catch {
      token = null
    }

    if (!token) {
      return
    }

    const searchParams = new URLSearchParams()
    if (search) searchParams.set('search', search)
    if (agentStatusFilter) searchParams.set('status', agentStatusFilter)
    if (agentPriorityFilter) searchParams.set('priority', agentPriorityFilter)
    if (agentCategoryFilter) searchParams.set('category', agentCategoryFilter)
    searchParams.set('sort', agentSort)
    const queryString = searchParams.toString()

    let isCurrent = true
    setFilteredAgentTicketsStatus('loading')

    let request = filteredAgentTicketsRequest.current

    if (!request || request.token !== token || request.query !== queryString) {
      const promise = fetch(`http://localhost:5000/api/tickets?${queryString}`, {
        headers: {
          Authorization: ['Bearer', token].join(' '),
        },
      }).then(async (response) => {
        if (response.status === 401 || response.status === 403) {
          return { type: 'unauthorized' }
        }

        let result

        try {
          result = await response.json()
        } catch {
          return { type: 'error' }
        }

        if (!response.ok || !Array.isArray(result?.tickets)) {
          return { type: 'error' }
        }

        return { type: 'success', tickets: result.tickets }
      }).catch(() => ({ type: 'error' }))

      request = { token, query: queryString, promise }
      filteredAgentTicketsRequest.current = request
    }

    request.promise.then((result) => {
      if (!isCurrent) {
        return
      }

      if (filteredAgentTicketsRequest.current === request) {
        filteredAgentTicketsRequest.current = null
      }

      if (result.type === 'unauthorized') {
        window.localStorage.removeItem('token')
        window.localStorage.removeItem('user')
        window.history.replaceState({}, '', '/login')
        setLocationPath('/login')
        setCurrentUser(null)
        setTickets([])
        setFilteredAgentTickets([])
        setFilteredAgentTicketsStatus('idle')
        setTicketsStatus('idle')
        setDashboardStatus('idle')
        setFormMessage({ type: 'error', text: 'Your session has expired. Please sign in again.' })
        setPage('login')
        return
      }

      if (result.type === 'error') {
        setFilteredAgentTicketsStatus('error')
        return
      }

      setFilteredAgentTickets(result.tickets)
      setFilteredAgentTicketsStatus('ready')
    })

    return () => {
      isCurrent = false
    }
  }, [
    page,
    locationPath,
    dashboardStatus,
    currentUser?.role,
    ticketsStatus,
    tickets,
    selectedAgentTicketId,
    agentSearchQuery,
    agentStatusFilter,
    agentPriorityFilter,
    agentCategoryFilter,
    agentSort,
    filteredAgentTicketsAttempt,
  ])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setAgentSearchQuery(agentSearch.trim())
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [agentSearch])

  useEffect(() => {
    if (
      page !== 'dashboard' ||
      locationPath !== dashboardPaths.admin ||
      dashboardStatus !== 'ready' ||
      currentUser?.role !== 'admin'
    ) {
      return
    }

    let token

    try {
      token = window.localStorage.getItem('token')
    } catch {
      token = null
    }

    if (!token) {
      return
    }

    let isCurrent = true
    setAdminDataStatus('loading')

    let request = adminDataRequest.current

    if (!request || request.token !== token) {
      const promise = Promise.all([
        fetch('http://localhost:5000/api/tickets', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('http://localhost:5000/api/auth/users', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]).then(async ([ticketResponse, userResponse]) => {
        if (
          [ticketResponse.status, userResponse.status].some(
            (status) => status === 401 || status === 403,
          )
        ) {
          return { type: 'unauthorized' }
        }

        let ticketResult
        let userResult
        try {
          const results = await Promise.all([
            ticketResponse.json(),
            userResponse.json(),
          ])
          ticketResult = results[0]
          userResult = results[1]
        } catch {
          return { type: 'error' }
        }

        if (
          !ticketResponse.ok ||
          !userResponse.ok ||
          !Array.isArray(ticketResult?.tickets) ||
          !Array.isArray(userResult?.users)
        ) {
          return { type: 'error' }
        }

        return {
          type: 'success',
          tickets: ticketResult.tickets,
          users: userResult.users,
        }
      }).catch(() => ({ type: 'error' }))

      request = { token, promise }
      adminDataRequest.current = request
    }

    request.promise.then((result) => {
      if (!isCurrent) {
        return
      }

      if (result.type !== 'success' && adminDataRequest.current === request) {
        adminDataRequest.current = null
      }

      if (result.type === 'unauthorized') {
        window.localStorage.removeItem('token')
        window.localStorage.removeItem('user')
        window.history.replaceState({}, '', '/login')
        setLocationPath('/login')
        setCurrentUser(null)
        setAdminTickets([])
        setAdminUsers([])
        setAdminDataStatus('idle')
        setDashboardStatus('idle')
        setFormMessage({ type: 'error', text: 'Your session has expired. Please sign in again.' })
        setPage('login')
        return
      }

      if (result.type === 'error') {
        setAdminDataStatus('error')
        return
      }

      setAdminTickets(result.tickets)
      setAdminUsers(result.users)
      setAdminDataStatus('ready')
    })

    return () => {
      isCurrent = false
    }
  }, [page, locationPath, dashboardStatus, currentUser?.role, adminDataAttempt])

  useEffect(() => {
    if (
      page !== 'dashboard' ||
      locationPath !== dashboardPaths.admin ||
      dashboardStatus !== 'ready' ||
      currentUser?.role !== 'admin'
    ) {
      setAdminAnalyticsStatus('idle')
      return
    }

    let token

    try {
      token = window.localStorage.getItem('token')
    } catch {
      token = null
    }

    if (!token) {
      handleLogout()
      return
    }

    let isCurrent = true
    setAdminAnalyticsStatus('loading')
    setAdminAnalyticsError('')

    async function fetchAnalytics() {
      const endpoints = [
        '/api/admin/analytics/status',
        '/api/admin/analytics/priority',
        '/api/admin/analytics/category',
        '/api/admin/analytics/tickets-over-time?granularity=day',
        '/api/admin/analytics/agents',
      ]

      try {
        const responses = await Promise.all(
          endpoints.map((endpoint) =>
            fetch(`http://localhost:5000${endpoint}`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ),
        )

        if (responses.some((response) => response.status === 401 || response.status === 403)) {
          if (isCurrent) {
            handleLogout()
          }
          return
        }

        const results = await Promise.all(
          responses.map(async (response) => {
            try {
              return await response.json()
            } catch {
              return null
            }
          }),
        )

        if (
          responses.some((response) => !response.ok) ||
          !results[0]?.data ||
          typeof results[0].data !== 'object' ||
          Array.isArray(results[0].data) ||
          !results[1]?.data ||
          typeof results[1].data !== 'object' ||
          Array.isArray(results[1].data) ||
          !results[2]?.data ||
          typeof results[2].data !== 'object' ||
          Array.isArray(results[2].data) ||
          !Array.isArray(results[3]?.data) ||
          !Array.isArray(results[4]?.data)
        ) {
          throw new Error('Unable to load analytics.')
        }

        if (!isCurrent) {
          return
        }

        setAdminStatusAnalytics(results[0].data)
        setAdminPriorityAnalytics(results[1].data)
        setAdminCategoryAnalytics(results[2].data)
        setAdminDailyTicketTrends(results[3].data)
        setAdminAgentAnalytics(results[4].data)
        setAdminAnalyticsStatus('ready')
      } catch {
        if (isCurrent) {
          setAdminAnalyticsError('Unable to load analytics. Please try again.')
          setAdminAnalyticsStatus('error')
        }
      }
    }

    void fetchAnalytics()

    return () => {
      isCurrent = false
    }
  }, [
    page,
    locationPath,
    dashboardStatus,
    currentUser?.role,
    adminAnalyticsAttempt,
  ])

  useEffect(() => {
    const search = adminSearchQuery.trim()
    const hasFilters = Boolean(
      search ||
      adminStatusFilter ||
      adminPriorityFilter ||
      adminCategoryFilter ||
      adminSort === 'oldest',
    )

    if (
      page !== 'dashboard' ||
      locationPath !== dashboardPaths.admin ||
      dashboardStatus !== 'ready' ||
      currentUser?.role !== 'admin' ||
      selectedAdminTicketId ||
      adminDataStatus !== 'ready' ||
      !hasFilters
    ) {
      setFilteredAdminTicketsStatus('idle')
      return
    }

    if (adminTickets.length === 0) {
      setFilteredAdminTickets([])
      setFilteredAdminTicketsStatus('ready')
      return
    }

    let token

    try {
      token = window.localStorage.getItem('token')
    } catch {
      token = null
    }

    if (!token) {
      return
    }

    const searchParams = new URLSearchParams()
    if (search) searchParams.set('search', search)
    if (adminStatusFilter) searchParams.set('status', adminStatusFilter)
    if (adminPriorityFilter) searchParams.set('priority', adminPriorityFilter)
    if (adminCategoryFilter) searchParams.set('category', adminCategoryFilter)
    searchParams.set('sort', adminSort)
    const queryString = searchParams.toString()

    let isCurrent = true
    setFilteredAdminTicketsStatus('loading')

    let request = filteredAdminTicketsRequest.current

    if (!request || request.token !== token || request.query !== queryString) {
      const promise = fetch(`http://localhost:5000/api/tickets?${queryString}`, {
        headers: {
          Authorization: ['Bearer', token].join(' '),
        },
      }).then(async (response) => {
        if (response.status === 401 || response.status === 403) {
          return { type: 'unauthorized' }
        }

        let result

        try {
          result = await response.json()
        } catch {
          return { type: 'error' }
        }

        if (!response.ok || !Array.isArray(result?.tickets)) {
          return { type: 'error' }
        }

        return { type: 'success', tickets: result.tickets }
      }).catch(() => ({ type: 'error' }))

      request = { token, query: queryString, promise }
      filteredAdminTicketsRequest.current = request
    }

    request.promise.then((result) => {
      if (!isCurrent) {
        return
      }

      if (filteredAdminTicketsRequest.current === request) {
        filteredAdminTicketsRequest.current = null
      }

      if (result.type === 'unauthorized') {
        window.localStorage.removeItem('token')
        window.localStorage.removeItem('user')
        window.history.replaceState({}, '', '/login')
        setLocationPath('/login')
        setCurrentUser(null)
        setAdminTickets([])
        setAdminUsers([])
        setFilteredAdminTickets([])
        setFilteredAdminTicketsStatus('idle')
        setAdminDataStatus('idle')
        setDashboardStatus('idle')
        setFormMessage({ type: 'error', text: 'Your session has expired. Please sign in again.' })
        setPage('login')
        return
      }

      if (result.type === 'error') {
        setFilteredAdminTicketsStatus('error')
        return
      }

      setFilteredAdminTickets(result.tickets)
      setFilteredAdminTicketsStatus('ready')
    })

    return () => {
      isCurrent = false
    }
  }, [
    page,
    locationPath,
    dashboardStatus,
    currentUser?.role,
    adminDataStatus,
    adminTickets.length,
    selectedAdminTicketId,
    adminSearchQuery,
    adminStatusFilter,
    adminPriorityFilter,
    adminCategoryFilter,
    adminSort,
    filteredAdminTicketsAttempt,
  ])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setAdminSearchQuery(adminSearch.trim())
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [adminSearch])

  useEffect(() => {
    if (
      page !== 'dashboard' ||
      locationPath !== dashboardPaths.admin ||
      dashboardStatus !== 'ready' ||
      currentUser?.role !== 'admin' ||
      !selectedAdminTicketId
    ) {
      return
    }

    let token

    try {
      token = window.localStorage.getItem('token')
    } catch {
      token = null
    }

    if (!token) {
      return
    }

    let isCurrent = true
    setAdminTicketDetailsStatus('loading')
    let request = adminTicketDetailsRequest.current

    if (
      !request ||
      request.token !== token ||
      request.ticketId !== selectedAdminTicketId
    ) {
      const promise = fetch(
        `http://localhost:5000/api/tickets/${encodeURIComponent(selectedAdminTicketId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      ).then(async (response) => {
        if (response.status === 401 || response.status === 403) {
          return { type: 'unauthorized' }
        }

        let result

        try {
          result = await response.json()
        } catch {
          return { type: 'error' }
        }

        if (!response.ok || !result?.ticket || typeof result.ticket !== 'object') {
          return { type: 'error' }
        }

        return { type: 'success', ticket: result.ticket }
      }).catch(() => ({ type: 'error' }))

      request = { token, ticketId: selectedAdminTicketId, promise }
      adminTicketDetailsRequest.current = request
    }

    request.promise.then((result) => {
      if (!isCurrent) {
        return
      }

      if (result.type !== 'success' && adminTicketDetailsRequest.current === request) {
        adminTicketDetailsRequest.current = null
      }

      if (result.type === 'unauthorized') {
        window.localStorage.removeItem('token')
        window.localStorage.removeItem('user')
        window.history.replaceState({}, '', '/login')
        setLocationPath('/login')
        setCurrentUser(null)
        setAdminTickets([])
        setAdminUsers([])
        setAdminTicketDetails(null)
        setAdminTicketComments([])
        setSelectedAdminTicketId(null)
        setAdminTicketDetailsStatus('idle')
        setAdminTicketCommentsStatus('idle')
        setDashboardStatus('idle')
        setFormMessage({ type: 'error', text: 'Your session has expired. Please sign in again.' })
        setPage('login')
        return
      }

      if (result.type === 'error') {
        setAdminTicketDetailsStatus('error')
        return
      }

      setAdminTicketDetails(result.ticket)
      setAdminAssignmentSelection(
        result.ticket.assignedAgent?._id ? String(result.ticket.assignedAgent._id) : '',
      )
      setAdminStatusSelection(result.ticket.status || '')
      setAdminTicketDetailsStatus('ready')
    })

    return () => {
      isCurrent = false
    }
  }, [
    page,
    locationPath,
    dashboardStatus,
    currentUser?.role,
    selectedAdminTicketId,
    adminTicketDetailsAttempt,
  ])

  useEffect(() => {
    if (
      page !== 'dashboard' ||
      locationPath !== dashboardPaths.admin ||
      dashboardStatus !== 'ready' ||
      currentUser?.role !== 'admin' ||
      !selectedAdminTicketId ||
      adminTicketDetailsStatus !== 'ready'
    ) {
      return
    }

    let token

    try {
      token = window.localStorage.getItem('token')
    } catch {
      token = null
    }

    if (!token) {
      return
    }

    let isCurrent = true
    setAdminTicketCommentsStatus('loading')
    let request = adminTicketCommentsRequest.current

    if (
      !request ||
      request.token !== token ||
      request.ticketId !== selectedAdminTicketId
    ) {
      const promise = fetch(
        `http://localhost:5000/api/tickets/${encodeURIComponent(selectedAdminTicketId)}/comments`,
        { headers: { Authorization: `Bearer ${token}` } },
      ).then(async (response) => {
        if (response.status === 401 || response.status === 403) {
          return { type: 'unauthorized' }
        }

        let result

        try {
          result = await response.json()
        } catch {
          return { type: 'error' }
        }

        if (!response.ok || !Array.isArray(result?.comments)) {
          return { type: 'error' }
        }

        return { type: 'success', comments: result.comments }
      }).catch(() => ({ type: 'error' }))

      request = { token, ticketId: selectedAdminTicketId, promise }
      adminTicketCommentsRequest.current = request
    }

    request.promise.then((result) => {
      if (!isCurrent) {
        return
      }

      if (result.type !== 'success' && adminTicketCommentsRequest.current === request) {
        adminTicketCommentsRequest.current = null
      }

      if (result.type === 'unauthorized') {
        window.localStorage.removeItem('token')
        window.localStorage.removeItem('user')
        window.history.replaceState({}, '', '/login')
        setLocationPath('/login')
        setCurrentUser(null)
        setAdminTickets([])
        setAdminUsers([])
        setAdminTicketDetails(null)
        setAdminTicketComments([])
        setSelectedAdminTicketId(null)
        setAdminTicketDetailsStatus('idle')
        setAdminTicketCommentsStatus('idle')
        setDashboardStatus('idle')
        setFormMessage({ type: 'error', text: 'Your session has expired. Please sign in again.' })
        setPage('login')
        return
      }

      if (result.type === 'error') {
        setAdminTicketCommentsStatus('error')
        return
      }

      setAdminTicketComments(result.comments)
      setAdminTicketCommentsStatus('ready')
    })

    return () => {
      isCurrent = false
    }
  }, [
    page,
    locationPath,
    dashboardStatus,
    currentUser?.role,
    selectedAdminTicketId,
    adminTicketDetailsStatus,
    adminTicketCommentsAttempt,
  ])

  useEffect(() => {
    if (
      page !== 'dashboard' ||
      locationPath !== dashboardPaths.agent ||
      dashboardStatus !== 'ready' ||
      currentUser?.role !== 'agent' ||
      !selectedAgentTicketId
    ) {
      return
    }

    let token

    try {
      token = window.localStorage.getItem('token')
    } catch {
      token = null
    }

    if (!token) {
      return
    }

    let isCurrent = true
    setAgentTicketDetailsStatus('loading')

    let request = agentTicketDetailsRequest.current

    if (
      !request ||
      request.token !== token ||
      request.ticketId !== selectedAgentTicketId
    ) {
      const promise = fetch(
        `http://localhost:5000/api/tickets/${encodeURIComponent(selectedAgentTicketId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      ).then(async (response) => {
        if (response.status === 401 || response.status === 403) {
          return { type: 'unauthorized' }
        }

        let result

        try {
          result = await response.json()
        } catch {
          return { type: 'error' }
        }

        if (!response.ok || !result?.ticket || typeof result.ticket !== 'object') {
          return { type: 'error' }
        }

        return { type: 'success', ticket: result.ticket }
      }).catch(() => ({ type: 'error' }))

      request = { token, ticketId: selectedAgentTicketId, promise }
      agentTicketDetailsRequest.current = request
    }

    request.promise.then((result) => {
      if (!isCurrent) {
        return
      }

      if (result.type !== 'success' && agentTicketDetailsRequest.current === request) {
        agentTicketDetailsRequest.current = null
      }

      if (result.type === 'unauthorized') {
        window.localStorage.removeItem('token')
        window.localStorage.removeItem('user')
        window.history.replaceState({}, '', '/login')
        setLocationPath('/login')
        setCurrentUser(null)
        setAgentTicketDetails(null)
        setSelectedAgentTicketId(null)
        setAgentTicketDetailsStatus('idle')
        setDashboardStatus('idle')
        setFormMessage({ type: 'error', text: 'Your session has expired. Please sign in again.' })
        setPage('login')
        return
      }

      if (result.type === 'error') {
        setAgentTicketDetailsStatus('error')
        return
      }

      setAgentTicketDetails(result.ticket)
      setAgentTicketStatusSelection(
        ['open', 'in_progress', 'resolved'].includes(result.ticket.status)
          ? result.ticket.status
          : '',
      )
      setAgentTicketDetailsStatus('ready')
    })

    return () => {
      isCurrent = false
    }
  }, [
    page,
    locationPath,
    dashboardStatus,
    currentUser?.role,
    selectedAgentTicketId,
    agentTicketDetailsAttempt,
  ])

  useEffect(() => {
    if (
      page !== 'dashboard' ||
      locationPath !== dashboardPaths.agent ||
      dashboardStatus !== 'ready' ||
      currentUser?.role !== 'agent' ||
      !selectedAgentTicketId ||
      agentTicketDetailsStatus !== 'ready'
    ) {
      return
    }

    let token

    try {
      token = window.localStorage.getItem('token')
    } catch {
      token = null
    }

    if (!token) {
      return
    }

    let isCurrent = true
    setAgentCommentsStatus('loading')

    let request = agentCommentsRequest.current

    if (
      !request ||
      request.token !== token ||
      request.ticketId !== selectedAgentTicketId
    ) {
      const promise = fetch(
        `http://localhost:5000/api/tickets/${encodeURIComponent(selectedAgentTicketId)}/comments`,
        { headers: { Authorization: `Bearer ${token}` } },
      ).then(async (response) => {
        if (response.status === 401 || response.status === 403) {
          return { type: 'unauthorized' }
        }

        let result

        try {
          result = await response.json()
        } catch {
          return { type: 'error' }
        }

        if (!response.ok || !Array.isArray(result?.comments)) {
          return { type: 'error' }
        }

        return { type: 'success', comments: result.comments }
      }).catch(() => ({ type: 'error' }))

      request = { token, ticketId: selectedAgentTicketId, promise }
      agentCommentsRequest.current = request
    }

    request.promise.then((result) => {
      if (!isCurrent) {
        return
      }

      if (result.type !== 'success' && agentCommentsRequest.current === request) {
        agentCommentsRequest.current = null
      }

      if (result.type === 'unauthorized') {
        window.localStorage.removeItem('token')
        window.localStorage.removeItem('user')
        window.history.replaceState({}, '', '/login')
        setLocationPath('/login')
        setCurrentUser(null)
        setTickets([])
        setAgentTicketDetails(null)
        setSelectedAgentTicketId(null)
        setAgentComments([])
        setAgentCommentsStatus('idle')
        setDashboardStatus('idle')
        setFormMessage({ type: 'error', text: 'Your session has expired. Please sign in again.' })
        setPage('login')
        return
      }

      if (result.type === 'error') {
        setAgentCommentsStatus('error')
        return
      }

      setAgentComments(result.comments)
      setAgentCommentsStatus('ready')
    })

    return () => {
      isCurrent = false
    }
  }, [
    page,
    locationPath,
    dashboardStatus,
    currentUser?.role,
    selectedAgentTicketId,
    agentTicketDetailsStatus,
    agentCommentsAttempt,
  ])

  useEffect(() => {
    if (
      page !== 'dashboard' ||
      locationPath !== dashboardPaths.customer ||
      dashboardStatus !== 'ready' ||
      currentUser?.role !== 'customer' ||
      !selectedCustomerTicketId
    ) {
      return
    }

    let token

    try {
      token = window.localStorage.getItem('token')
    } catch {
      token = null
    }

    if (!token) {
      return
    }

    let isCurrent = true
    setCustomerTicketDetailsStatus('loading')

    let request = customerTicketDetailsRequest.current

    if (
      !request ||
      request.token !== token ||
      request.ticketId !== selectedCustomerTicketId
    ) {
      const promise = fetch(
        `http://localhost:5000/api/tickets/${encodeURIComponent(selectedCustomerTicketId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      ).then(async (response) => {
        if (response.status === 401 || response.status === 403) {
          return { type: 'unauthorized' }
        }

        let result

        try {
          result = await response.json()
        } catch {
          return { type: 'error' }
        }

        if (!response.ok || !result?.ticket || typeof result.ticket !== 'object') {
          return { type: 'error' }
        }

        return { type: 'success', ticket: result.ticket }
      }).catch(() => ({ type: 'error' }))

      request = { token, ticketId: selectedCustomerTicketId, promise }
      customerTicketDetailsRequest.current = request
    }

    request.promise.then((result) => {
      if (!isCurrent) {
        return
      }

      if (result.type !== 'success' && customerTicketDetailsRequest.current === request) {
        customerTicketDetailsRequest.current = null
      }

      if (result.type === 'unauthorized') {
        window.localStorage.removeItem('token')
        window.localStorage.removeItem('user')
        window.history.replaceState({}, '', '/login')
        setLocationPath('/login')
        setCurrentUser(null)
        setTickets([])
        setCustomerTicketDetails(null)
        setSelectedCustomerTicketId(null)
        setCustomerComments([])
        setCustomerCommentsStatus('idle')
        setTicketsStatus('idle')
        setDashboardStatus('idle')
        setFormMessage({ type: 'error', text: 'Your session has expired. Please sign in again.' })
        setPage('login')
        return
      }

      if (result.type === 'error') {
        setCustomerTicketDetailsStatus('error')
        return
      }

      setCustomerTicketDetails(result.ticket)
      setCustomerTicketDetailsStatus('ready')
    })

    return () => {
      isCurrent = false
    }
  }, [
    page,
    locationPath,
    dashboardStatus,
    currentUser?.role,
    selectedCustomerTicketId,
    customerTicketDetailsAttempt,
  ])

  useEffect(() => {
    if (
      page !== 'dashboard' ||
      locationPath !== dashboardPaths.customer ||
      dashboardStatus !== 'ready' ||
      currentUser?.role !== 'customer' ||
      !selectedCustomerTicketId ||
      customerTicketDetailsStatus !== 'ready'
    ) {
      return
    }

    let token

    try {
      token = window.localStorage.getItem('token')
    } catch {
      token = null
    }

    if (!token) {
      return
    }

    let isCurrent = true
    setCustomerCommentsStatus('loading')

    let request = customerCommentsRequest.current

    if (
      !request ||
      request.token !== token ||
      request.ticketId !== selectedCustomerTicketId
    ) {
      const promise = fetch(
        `http://localhost:5000/api/tickets/${encodeURIComponent(selectedCustomerTicketId)}/comments`,
        { headers: { Authorization: `Bearer ${token}` } },
      ).then(async (response) => {
        if (response.status === 401 || response.status === 403) {
          return { type: 'unauthorized' }
        }

        let result

        try {
          result = await response.json()
        } catch {
          return { type: 'error' }
        }

        if (!response.ok || !Array.isArray(result?.comments)) {
          return { type: 'error' }
        }

        return { type: 'success', comments: result.comments }
      }).catch(() => ({ type: 'error' }))

      request = { token, ticketId: selectedCustomerTicketId, promise }
      customerCommentsRequest.current = request
    }

    request.promise.then((result) => {
      if (!isCurrent) {
        return
      }

      if (result.type !== 'success' && customerCommentsRequest.current === request) {
        customerCommentsRequest.current = null
      }

      if (result.type === 'unauthorized') {
        window.localStorage.removeItem('token')
        window.localStorage.removeItem('user')
        window.history.replaceState({}, '', '/login')
        setLocationPath('/login')
        setCurrentUser(null)
        setTickets([])
        setCustomerTicketDetails(null)
        setSelectedCustomerTicketId(null)
        setCustomerComments([])
        setCustomerCommentsStatus('idle')
        setTicketsStatus('idle')
        setDashboardStatus('idle')
        setFormMessage({ type: 'error', text: 'Your session has expired. Please sign in again.' })
        setPage('login')
        return
      }

      if (result.type === 'error') {
        setCustomerCommentsStatus('error')
        return
      }

      setCustomerComments(result.comments)
      setCustomerCommentsStatus('ready')
    })

    return () => {
      isCurrent = false
    }
  }, [
    page,
    locationPath,
    dashboardStatus,
    currentUser?.role,
    selectedCustomerTicketId,
    customerTicketDetailsStatus,
    customerCommentsAttempt,
  ])

  function navigate(event, path) {
    event.preventDefault()
    window.history.pushState({}, '', path)
    setLocationPath(path)
    setPage(getCurrentPage())
    setShowPassword(false)
    setShowConfirmPassword(false)
    setFormMessage(null)
    if (path === dashboardPaths.customer) {
      setTicketsStatus('idle')
    }
    if (path === '/dashboard') {
      setDashboardStatus('loading')
    }
  }

  function handleLogout() {
    window.localStorage.removeItem('token')
    window.localStorage.removeItem('user')
    window.history.replaceState({}, '', '/login')
    setLocationPath('/login')
    verificationRequest.current = null
    setCurrentUser(null)
    setTickets([])
    setTicketsStatus('idle')
    setAdminTickets([])
    setAdminUsers([])
    setAdminDataStatus('idle')
    adminDataRequest.current = null
    setSelectedAgentTicketId(null)
    setAgentTicketDetails(null)
    setAgentTicketDetailsStatus('idle')
    setAgentTicketStatusMessage(null)
    setAgentTicketStatusSelection('')
    setAgentComments([])
    setAgentCommentsStatus('idle')
    setAgentCommentsAttempt(0)
    setAgentCommentDraft('')
    setAgentCommentMessage(null)
    agentCommentsRequest.current = null
    agentTicketDetailsRequest.current = null
    setSelectedCustomerTicketId(null)
    setCustomerTicketDetails(null)
    setCustomerTicketDetailsStatus('idle')
    setCustomerTicketDetailsAttempt(0)
    setCustomerComments([])
    setCustomerCommentsStatus('idle')
    setCustomerCommentsAttempt(0)
    setCustomerCommentDraft('')
    setCustomerCommentMessage(null)
    customerTicketDetailsRequest.current = null
    customerCommentsRequest.current = null
    setPage('login')
    setDashboardStatus('idle')
    setShowPassword(false)
    setShowConfirmPassword(false)
    setFormMessage(null)
  }

  function handleNotificationTicketClick(ticketId) {
    if (currentUser?.role === 'admin') {
      const isSelectedTicket = selectedAdminTicketId === ticketId
      setAdminTicketDetails(null)
      setAdminTicketDetailsStatus('loading')
      setAdminTicketComments([])
      setAdminTicketCommentsStatus('idle')
      setAdminAssignmentMessage(null)
      setAdminStatusMessage(null)
      adminTicketDetailsRequest.current = null
      adminTicketCommentsRequest.current = null
      if (isSelectedTicket) {
        setAdminTicketDetailsAttempt((attempt) => attempt + 1)
      } else {
        setSelectedAdminTicketId(ticketId)
      }
      return
    }

    if (currentUser?.role === 'agent') {
      const isSelectedTicket = selectedAgentTicketId === ticketId
      setAgentTicketDetails(null)
      setAgentTicketDetailsStatus('loading')
      setAgentComments([])
      setAgentCommentsStatus('idle')
      setAgentCommentDraft('')
      setAgentCommentMessage(null)
      agentTicketDetailsRequest.current = null
      agentCommentsRequest.current = null
      if (isSelectedTicket) {
        setAgentTicketDetailsAttempt((attempt) => attempt + 1)
      } else {
        setSelectedAgentTicketId(ticketId)
      }
      return
    }

    if (currentUser?.role === 'customer') {
      const isSelectedTicket = selectedCustomerTicketId === ticketId
      setCustomerTicketDetails(null)
      setCustomerTicketDetailsStatus('loading')
      setCustomerComments([])
      setCustomerCommentsStatus('idle')
      setCustomerCommentDraft('')
      setCustomerCommentMessage(null)
      customerTicketDetailsRequest.current = null
      customerCommentsRequest.current = null
      if (isSelectedTicket) {
        setCustomerTicketDetailsAttempt((attempt) => attempt + 1)
      } else {
        setSelectedCustomerTicketId(ticketId)
      }
    }
  }

  async function handleTicketSubmit(event) {
    event.preventDefault()

    if (isCreatingTicket) {
      return
    }

    const form = event.currentTarget
    const formData = new FormData(form)
    const title = formData.get('ticket-title')
    const description = formData.get('ticket-description')

    if (
      typeof title !== 'string' ||
      typeof description !== 'string' ||
      !title.trim() ||
      !description.trim()
    ) {
      setTicketMessage({ type: 'error', text: 'Please enter a title and description.' })
      return
    }

    let token

    try {
      token = window.localStorage.getItem('token')
    } catch {
      token = null
    }

    if (!token) {
      window.localStorage.removeItem('token')
      window.localStorage.removeItem('user')
      window.history.replaceState({}, '', '/login')
      setLocationPath('/login')
      setCurrentUser(null)
      setTickets([])
      setTicketsStatus('idle')
      setDashboardStatus('idle')
      setFormMessage({ type: 'error', text: 'Your session has expired. Please sign in again.' })
      setPage('login')
      return
    }

    setIsCreatingTicket(true)
    setTicketMessage(null)

    try {
      const response = await fetch('http://localhost:5000/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
        }),
      })

      let result

      try {
        result = await response.json()
      } catch {
        result = null
      }

      if (response.status === 401 || response.status === 403) {
        window.localStorage.removeItem('token')
        window.localStorage.removeItem('user')
        window.history.replaceState({}, '', '/login')
        setLocationPath('/login')
        setCurrentUser(null)
        setTickets([])
        setTicketsStatus('idle')
        setDashboardStatus('idle')
        setFormMessage({ type: 'error', text: 'Your session has expired. Please sign in again.' })
        setPage('login')
        return
      }

      if (!response.ok) {
        setTicketMessage({
          type: 'error',
          text: result?.message || 'Unable to create your ticket. Please try again.',
        })
        return
      }

      setTicketMessage({
        type: 'success',
        text: result?.message || 'Ticket created successfully.',
      })
      form.reset()
      setIsTicketFormOpen(false)
      ticketsRequest.current = null
      filteredCustomerTicketsRequest.current = null
      setTicketsAttempt((attempt) => attempt + 1)
    } catch {
      setTicketMessage({
        type: 'error',
        text: 'Unable to connect to the server. Please try again.',
      })
    } finally {
      setIsCreatingTicket(false)
    }
  }

  async function handleAssignTicket(event, ticketId) {
    event.preventDefault()

    if (assignmentInProgress.current) {
      return
    }

    const formData = new FormData(event.currentTarget)
    const agentId = formData.get('agentId')

    if (typeof agentId !== 'string' || !agentId) {
      setAssignmentMessage({ type: 'error', text: 'Select an active agent to assign this ticket.' })
      return
    }

    let token

    try {
      token = window.localStorage.getItem('token')
    } catch {
      token = null
    }

    if (!token) {
      window.localStorage.removeItem('token')
      window.localStorage.removeItem('user')
      window.history.replaceState({}, '', '/login')
      setLocationPath('/login')
      setCurrentUser(null)
      setAdminTickets([])
      setAdminUsers([])
      setAdminDataStatus('idle')
      setDashboardStatus('idle')
      setFormMessage({ type: 'error', text: 'Your session has expired. Please sign in again.' })
      setPage('login')
      return
    }

    assignmentInProgress.current = true
    setAssigningTicketId(ticketId)
    setAssignmentMessage(null)

    try {
      const response = await fetch(`http://localhost:5000/api/tickets/${ticketId}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ agentId }),
      })

      let result

      try {
        result = await response.json()
      } catch {
        result = null
      }

      if (response.status === 401 || response.status === 403) {
        window.localStorage.removeItem('token')
        window.localStorage.removeItem('user')
        window.history.replaceState({}, '', '/login')
        setLocationPath('/login')
        setCurrentUser(null)
        setAdminTickets([])
        setAdminUsers([])
        setAdminDataStatus('idle')
        setDashboardStatus('idle')
        setFormMessage({ type: 'error', text: 'Your session has expired. Please sign in again.' })
        setPage('login')
        return
      }

      if (!response.ok || !result?.ticket) {
        setAssignmentMessage({
          type: 'error',
          text: result?.message || 'Unable to assign this ticket. Please try again.',
        })
        return
      }

      setAdminTickets((existingTickets) =>
        existingTickets.map((ticket) =>
          ticket._id === ticketId ? result.ticket : ticket,
        ),
      )
      if (selectedAdminTicketId === ticketId) {
        setAdminTicketDetails(result.ticket)
        adminTicketDetailsRequest.current = null
        setAdminTicketDetailsAttempt((attempt) => attempt + 1)
      }
      setAssignmentMessage({
        type: 'success',
        text: result.message || 'Ticket assigned successfully.',
      })
      adminDataRequest.current = null
      filteredAdminTicketsRequest.current = null
      setAdminDataAttempt((attempt) => attempt + 1)
    } catch {
      setAssignmentMessage({
        type: 'error',
        text: 'Unable to connect to the server. Please try again.',
      })
    } finally {
      assignmentInProgress.current = false
      setAssigningTicketId(null)
    }
  }

  async function handleAgentStatusToggle(agent) {
    if (agentStatusUpdateInProgress.current) {
      return
    }

    let token

    try {
      token = window.localStorage.getItem('token')
    } catch {
      token = null
    }

    if (!token) {
      window.localStorage.removeItem('token')
      window.localStorage.removeItem('user')
      window.history.replaceState({}, '', '/login')
      setLocationPath('/login')
      setCurrentUser(null)
      setAdminTickets([])
      setAdminUsers([])
      setAdminDataStatus('idle')
      setDashboardStatus('idle')
      setFormMessage({ type: 'error', text: 'Your session has expired. Please sign in again.' })
      setPage('login')
      return
    }

    agentStatusUpdateInProgress.current = true
    setUpdatingAgentStatusId(agent.id)
    setAgentStatusMessage(null)

    try {
      const response = await fetch(
        `http://localhost:5000/api/auth/users/${encodeURIComponent(agent.id)}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: ['Bearer', token].join(' '),
          },
          body: JSON.stringify({ isActive: !agent.isActive }),
        },
      )

      let result

      try {
        result = await response.json()
      } catch {
        result = null
      }

      if (response.status === 401 || response.status === 403) {
        window.localStorage.removeItem('token')
        window.localStorage.removeItem('user')
        window.history.replaceState({}, '', '/login')
        setLocationPath('/login')
        setCurrentUser(null)
        setAdminTickets([])
        setAdminUsers([])
        setAdminDataStatus('idle')
        setDashboardStatus('idle')
        setFormMessage({ type: 'error', text: 'Your session has expired. Please sign in again.' })
        setPage('login')
        return
      }

      if (!response.ok || !result?.user || typeof result.user.isActive !== 'boolean') {
        setAgentStatusMessage({
          type: 'error',
          text: result?.message || 'Unable to update agent status. Please try again.',
        })
        return
      }

      setAdminUsers((users) =>
        users.map((user) =>
          String(user.id) === String(result.user.id)
            ? { ...user, isActive: result.user.isActive }
            : user,
        ),
      )
      setAgentStatusMessage({
        type: 'success',
        text: result.message || `Agent ${result.user.isActive ? 'activated' : 'deactivated'} successfully.`,
      })
      adminDataRequest.current = null
      setAdminDataAttempt((attempt) => attempt + 1)
    } catch {
      setAgentStatusMessage({
        type: 'error',
        text: 'Unable to connect to the server. Please try again.',
      })
    } finally {
      agentStatusUpdateInProgress.current = false
      setUpdatingAgentStatusId(null)
    }
  }

  async function handleAdminTicketAssignment(event) {
    event.preventDefault()

    if (adminAssignmentInProgress.current || !selectedAdminTicketId) {
      return
    }

    if (!adminAssignmentSelection) {
      setAdminAssignmentMessage({ type: 'error', text: 'Select an active agent to assign this ticket.' })
      return
    }

    let token

    try {
      token = window.localStorage.getItem('token')
    } catch {
      token = null
    }

    if (!token) {
      window.localStorage.removeItem('token')
      window.localStorage.removeItem('user')
      window.history.replaceState({}, '', '/login')
      setLocationPath('/login')
      setCurrentUser(null)
      setAdminTicketDetails(null)
      setAdminTicketComments([])
      setSelectedAdminTicketId(null)
      setDashboardStatus('idle')
      setPage('login')
      return
    }

    adminAssignmentInProgress.current = true
    setIsAdminAssigningTicket(true)
    setAdminAssignmentMessage(null)

    try {
      const response = await fetch(
        `http://localhost:5000/api/tickets/${encodeURIComponent(selectedAdminTicketId)}/assign`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ agentId: adminAssignmentSelection }),
        },
      )

      let result

      try {
        result = await response.json()
      } catch {
        result = null
      }

      if (response.status === 401 || response.status === 403) {
        window.localStorage.removeItem('token')
        window.localStorage.removeItem('user')
        window.history.replaceState({}, '', '/login')
        setLocationPath('/login')
        setCurrentUser(null)
        setAdminTicketDetails(null)
        setAdminTicketComments([])
        setSelectedAdminTicketId(null)
        setDashboardStatus('idle')
        setPage('login')
        return
      }

      if (!response.ok || !result?.ticket) {
        setAdminAssignmentMessage({
          type: 'error',
          text: result?.message || 'Unable to assign this ticket. Please try again.',
        })
        return
      }

      setAdminTicketDetails(result.ticket)
      setAdminTickets((currentTickets) =>
        currentTickets.map((ticket) =>
          ticket._id === selectedAdminTicketId ? result.ticket : ticket,
        ),
      )
      setAdminAssignmentMessage({
        type: 'success',
        text: result.message || 'Ticket assigned successfully.',
      })
      adminDataRequest.current = null
      filteredAdminTicketsRequest.current = null
      setAdminDataAttempt((attempt) => attempt + 1)
      adminTicketDetailsRequest.current = null
      setAdminTicketDetailsAttempt((attempt) => attempt + 1)
    } catch {
      setAdminAssignmentMessage({
        type: 'error',
        text: 'Unable to connect to the server. Please try again.',
      })
    } finally {
      adminAssignmentInProgress.current = false
      setIsAdminAssigningTicket(false)
    }
  }

  async function handleAdminTicketStatusUpdate(event) {
    event.preventDefault()

    const allowedStatuses = ['open', 'in_progress', 'resolved', 'closed']

    if (
      adminStatusUpdateInProgress.current ||
      !selectedAdminTicketId ||
      !allowedStatuses.includes(adminStatusSelection)
    ) {
      return
    }

    let token

    try {
      token = window.localStorage.getItem('token')
    } catch {
      token = null
    }

    if (!token) {
      window.localStorage.removeItem('token')
      window.localStorage.removeItem('user')
      window.history.replaceState({}, '', '/login')
      setLocationPath('/login')
      setCurrentUser(null)
      setAdminTicketDetails(null)
      setAdminTicketComments([])
      setSelectedAdminTicketId(null)
      setDashboardStatus('idle')
      setPage('login')
      return
    }

    adminStatusUpdateInProgress.current = true
    setIsAdminUpdatingStatus(true)
    setAdminStatusMessage(null)

    try {
      const response = await fetch(
        `http://localhost:5000/api/tickets/${encodeURIComponent(selectedAdminTicketId)}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: adminStatusSelection }),
        },
      )

      let result

      try {
        result = await response.json()
      } catch {
        result = null
      }

      if (response.status === 401 || response.status === 403) {
        window.localStorage.removeItem('token')
        window.localStorage.removeItem('user')
        window.history.replaceState({}, '', '/login')
        setLocationPath('/login')
        setCurrentUser(null)
        setAdminTickets([])
        setAdminUsers([])
        setAdminTicketDetails(null)
        setAdminTicketComments([])
        setSelectedAdminTicketId(null)
        setAdminDataStatus('idle')
        setAdminTicketDetailsStatus('idle')
        setAdminTicketCommentsStatus('idle')
        setDashboardStatus('idle')
        setFormMessage({ type: 'error', text: 'Your session has expired. Please sign in again.' })
        setPage('login')
        return
      }

      if (!response.ok || !result?.ticket) {
        setAdminStatusMessage({
          type: 'error',
          text: result?.message || 'Unable to update ticket status. Please try again.',
        })
        return
      }

      setAdminTicketDetails((ticket) =>
        ticket ? { ...ticket, status: result.ticket.status } : ticket,
      )
      setAdminTickets((currentTickets) =>
        currentTickets.map((ticket) =>
          ticket._id === selectedAdminTicketId
            ? { ...ticket, status: result.ticket.status }
            : ticket,
        ),
      )
      setAdminStatusMessage({
        type: 'success',
        text: result.message || 'Ticket status updated successfully.',
      })
      adminDataRequest.current = null
      filteredAdminTicketsRequest.current = null
      setAdminDataAttempt((attempt) => attempt + 1)
      adminTicketDetailsRequest.current = null
      setAdminTicketDetailsAttempt((attempt) => attempt + 1)
    } catch {
      setAdminStatusMessage({
        type: 'error',
        text: 'Unable to connect to the server. Please try again.',
      })
    } finally {
      adminStatusUpdateInProgress.current = false
      setIsAdminUpdatingStatus(false)
    }
  }

  async function handleAgentTicketStatusUpdate(event) {
    event.preventDefault()

    if (ticketStatusUpdateInProgress.current || !selectedAgentTicketId) {
      return
    }

    const allowedStatuses = ['open', 'in_progress', 'resolved']
    if (!allowedStatuses.includes(agentTicketStatusSelection)) {
      setAgentTicketStatusMessage({ type: 'error', text: 'Select a valid ticket status.' })
      return
    }

    let token

    try {
      token = window.localStorage.getItem('token')
    } catch {
      token = null
    }

    if (!token) {
      window.localStorage.removeItem('token')
      window.localStorage.removeItem('user')
      window.history.replaceState({}, '', '/login')
      setLocationPath('/login')
      setCurrentUser(null)
      setAgentTicketDetails(null)
      setSelectedAgentTicketId(null)
      setAgentTicketDetailsStatus('idle')
      setDashboardStatus('idle')
      setFormMessage({ type: 'error', text: 'Your session has expired. Please sign in again.' })
      setPage('login')
      return
    }

    ticketStatusUpdateInProgress.current = true
    setIsUpdatingAgentTicketStatus(true)
    setAgentTicketStatusMessage(null)

    try {
      const response = await fetch(
        `http://localhost:5000/api/tickets/${encodeURIComponent(selectedAgentTicketId)}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: agentTicketStatusSelection }),
        },
      )

      let result

      try {
        result = await response.json()
      } catch {
        result = null
      }

      if (response.status === 401 || response.status === 403) {
        window.localStorage.removeItem('token')
        window.localStorage.removeItem('user')
        window.history.replaceState({}, '', '/login')
        setLocationPath('/login')
        setCurrentUser(null)
        setTickets([])
        setAgentTicketDetails(null)
        setSelectedAgentTicketId(null)
        setAgentTicketDetailsStatus('idle')
        setTicketsStatus('idle')
        setDashboardStatus('idle')
        setFormMessage({ type: 'error', text: 'Your session has expired. Please sign in again.' })
        setPage('login')
        return
      }

      if (!response.ok || !result?.ticket) {
        setAgentTicketStatusMessage({
          type: 'error',
          text: result?.message || 'Unable to update ticket status. Please try again.',
        })
        return
      }

      setAgentTicketStatusMessage({
        type: 'success',
        text: result.message || 'Ticket status updated successfully.',
      })
      setTickets((currentTickets) =>
        currentTickets.map((ticket) =>
          ticket._id === selectedAgentTicketId
            ? { ...ticket, status: result.ticket.status }
            : ticket,
        ),
      )
      ticketsRequest.current = null
      setTicketsAttempt((attempt) => attempt + 1)
      agentTicketDetailsRequest.current = null
      setAgentTicketDetailsAttempt((attempt) => attempt + 1)
    } catch {
      setAgentTicketStatusMessage({
        type: 'error',
        text: 'Unable to connect to the server. Please try again.',
      })
    } finally {
      ticketStatusUpdateInProgress.current = false
      setIsUpdatingAgentTicketStatus(false)
    }
  }

  async function handleAgentCommentSubmit(event) {
    event.preventDefault()

    if (agentCommentInProgress.current || !selectedAgentTicketId) {
      return
    }

    const message = agentCommentDraft.trim()

    if (!message) {
      setAgentCommentMessage({ type: 'error', text: 'Write a reply before sending.' })
      return
    }

    let token

    try {
      token = window.localStorage.getItem('token')
    } catch {
      token = null
    }

    if (!token) {
      window.localStorage.removeItem('token')
      window.localStorage.removeItem('user')
      window.history.replaceState({}, '', '/login')
      setLocationPath('/login')
      setCurrentUser(null)
      setTickets([])
      setAgentTicketDetails(null)
      setSelectedAgentTicketId(null)
      setAgentComments([])
      setAgentCommentsStatus('idle')
      setDashboardStatus('idle')
      setFormMessage({ type: 'error', text: 'Your session has expired. Please sign in again.' })
      setPage('login')
      return
    }

    agentCommentInProgress.current = true
    setIsSendingAgentComment(true)
    setAgentCommentMessage(null)

    try {
      const response = await fetch(
        `http://localhost:5000/api/tickets/${encodeURIComponent(selectedAgentTicketId)}/comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ message }),
        },
      )

      let result

      try {
        result = await response.json()
      } catch {
        result = null
      }

      if (response.status === 401 || response.status === 403) {
        window.localStorage.removeItem('token')
        window.localStorage.removeItem('user')
        window.history.replaceState({}, '', '/login')
        setLocationPath('/login')
        setCurrentUser(null)
        setTickets([])
        setAgentTicketDetails(null)
        setSelectedAgentTicketId(null)
        setAgentComments([])
        setAgentCommentsStatus('idle')
        setDashboardStatus('idle')
        setFormMessage({ type: 'error', text: 'Your session has expired. Please sign in again.' })
        setPage('login')
        return
      }

      if (!response.ok || !result?.comment) {
        setAgentCommentMessage({
          type: 'error',
          text: result?.message || 'Unable to send your reply. Please try again.',
        })
        return
      }

      setAgentCommentDraft('')
      setAgentCommentMessage({
        type: 'success',
        text: result.message || 'Reply sent successfully.',
      })
      agentCommentsRequest.current = null
      setAgentCommentsAttempt((attempt) => attempt + 1)
    } catch {
      setAgentCommentMessage({
        type: 'error',
        text: 'Unable to connect to the server. Please try again.',
      })
    } finally {
      agentCommentInProgress.current = false
      setIsSendingAgentComment(false)
    }
  }

  async function handleCustomerCommentSubmit(event) {
    event.preventDefault()

    if (customerCommentInProgress.current || !selectedCustomerTicketId) {
      return
    }

    const message = customerCommentDraft.trim()

    if (!message) {
      setCustomerCommentMessage({ type: 'error', text: 'Write a message before sending.' })
      return
    }

    let token

    try {
      token = window.localStorage.getItem('token')
    } catch {
      token = null
    }

    if (!token) {
      window.localStorage.removeItem('token')
      window.localStorage.removeItem('user')
      window.history.replaceState({}, '', '/login')
      setLocationPath('/login')
      setCurrentUser(null)
      setTickets([])
      setCustomerTicketDetails(null)
      setSelectedCustomerTicketId(null)
      setCustomerComments([])
      setCustomerCommentsStatus('idle')
      setTicketsStatus('idle')
      setDashboardStatus('idle')
      setFormMessage({ type: 'error', text: 'Your session has expired. Please sign in again.' })
      setPage('login')
      return
    }

    customerCommentInProgress.current = true
    setIsSendingCustomerComment(true)
    setCustomerCommentMessage(null)

    try {
      const response = await fetch(
        `http://localhost:5000/api/tickets/${encodeURIComponent(selectedCustomerTicketId)}/comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ message }),
        },
      )

      let result

      try {
        result = await response.json()
      } catch {
        result = null
      }

      if (response.status === 401 || response.status === 403) {
        window.localStorage.removeItem('token')
        window.localStorage.removeItem('user')
        window.history.replaceState({}, '', '/login')
        setLocationPath('/login')
        setCurrentUser(null)
        setTickets([])
        setCustomerTicketDetails(null)
        setSelectedCustomerTicketId(null)
        setCustomerComments([])
        setCustomerCommentsStatus('idle')
        setTicketsStatus('idle')
        setDashboardStatus('idle')
        setFormMessage({ type: 'error', text: 'Your session has expired. Please sign in again.' })
        setPage('login')
        return
      }

      if (!response.ok || !result?.comment) {
        setCustomerCommentMessage({
          type: 'error',
          text: result?.message || 'Unable to send your message. Please try again.',
        })
        return
      }

      setCustomerCommentDraft('')
      setCustomerCommentMessage({
        type: 'success',
        text: result.message || 'Message sent successfully.',
      })
      customerCommentsRequest.current = null
      setCustomerCommentsAttempt((attempt) => attempt + 1)
    } catch {
      setCustomerCommentMessage({
        type: 'error',
        text: 'Unable to connect to the server. Please try again.',
      })
    } finally {
      customerCommentInProgress.current = false
      setIsSendingCustomerComment(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    const form = event.currentTarget
    const formData = new FormData(form)
    const email = formData.get('email')
    const password = formData.get('password')

    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password.trim()) {
      setFormMessage({ type: 'error', text: 'Please enter your email and password.' })
      return
    }

    let requestBody = { email: email.trim(), password }
    let endpoint = 'login'

    if (isRegister) {
      const name = formData.get('name')
      const confirmPassword = formData.get('confirm-password')

      if (
        typeof name !== 'string' ||
        typeof confirmPassword !== 'string' ||
        !name.trim() ||
        !confirmPassword.trim()
      ) {
        setFormMessage({ type: 'error', text: 'Please fill in all fields.' })
        return
      }

      if (password !== confirmPassword) {
        setFormMessage({ type: 'error', text: 'Passwords do not match.' })
        return
      }

      endpoint = 'register'
      requestBody = {
        name: name.trim(),
        email: email.trim(),
        password,
      }
    }

    setIsSubmitting(true)
    setFormMessage(null)

    try {
      const response = await fetch(`http://localhost:5000/api/auth/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      let result

      try {
        result = await response.json()
      } catch {
        setFormMessage({
          type: 'error',
          text: 'The server returned an invalid response.',
        })
        return
      }

      if (!response.ok) {
        setFormMessage({
          type: 'error',
          text: result.message || 'Registration failed. Please try again.',
        })
        return
      }

      form.reset()
      setShowPassword(false)

      if (isRegister) {
        setShowConfirmPassword(false)
        setFormMessage({
          type: 'success',
          text: result.message || 'Registration successful.',
        })
        return
      }

      if (typeof result.token !== 'string' || !result.user || typeof result.user !== 'object') {
        setFormMessage({
          type: 'error',
          text: 'The server returned an invalid login response.',
        })
        return
      }

      const dashboardPath = getDashboardPath(result.user.role)

      if (!dashboardPath) {
        setFormMessage({
          type: 'error',
          text: 'Your account role is not supported.',
        })
        return
      }

      window.localStorage.setItem('token', result.token)
      window.localStorage.setItem('user', JSON.stringify(result.user))
      setCurrentUser(result.user)
      setFormMessage({
        type: 'success',
        text: result.message || 'Login successful.',
      })
      window.history.pushState({}, '', dashboardPath)
      setLocationPath(dashboardPath)
      setPage('dashboard')
    } catch {
      setFormMessage({
        type: 'error',
        text: 'Unable to connect to the server. Please try again.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (page === 'dashboard') {
    if (dashboardStatus !== 'ready') {
      return (
        <main className="auth-page">
          <section className="auth-card dashboard-card" aria-label="Verifying your session">
            <a className="brand" href="/login" onClick={(event) => navigate(event, '/login')}>
              <BrandMark />
              <span>SupportFlow</span>
            </a>
            <div className="form-heading">
              <h1>{dashboardStatus === 'loading' ? 'Loading your account' : 'Unable to load dashboard'}</h1>
            </div>
            {dashboardStatus === 'loading' ? (
              <p className="dashboard-welcome" role="status">Verifying your session…</p>
            ) : (
              <>
                <p className="dashboard-welcome" role="alert">
                  {formMessage?.text}
                </p>
                <button
                  className="submit-button dashboard-retry"
                  type="button"
                  onClick={() => setVerificationAttempt((attempt) => attempt + 1)}
                >
                  Try again
                </button>
              </>
            )}
            <button className="submit-button dashboard-logout" type="button" onClick={handleLogout}>
              Logout
            </button>
          </section>
        </main>
      )
    }

    const customerName =
      currentUser?.name || 'Customer'
    const userRole = currentUser?.role
    const dashboardPath = getDashboardPath(userRole)
    const roleLabel = userRole ? `${userRole[0].toUpperCase()}${userRole.slice(1)}` : null

    if (userRole === 'agent') {
      const agentName = currentUser?.name || 'Agent'
      const agentStats = [
        { label: 'Assigned Tickets', count: tickets.length, className: 'total' },
        {
          label: 'Open',
          count: tickets.filter((ticket) => ticket.status === 'open').length,
          className: 'open',
        },
        {
          label: 'In Progress',
          count: tickets.filter((ticket) => ticket.status === 'in_progress').length,
          className: 'progress',
        },
        {
          label: 'Resolved',
          count: tickets.filter((ticket) => ticket.status === 'resolved').length,
          className: 'resolved',
        },
      ]
      const hasAgentTicketFilters = Boolean(
        agentSearch.trim() ||
        agentStatusFilter ||
        agentPriorityFilter ||
        agentCategoryFilter ||
        agentSort !== 'newest',
      )
      const isAgentSearchPending = agentSearch.trim() !== agentSearchQuery.trim()
      const clearAgentTicketFilters = () => {
        setAgentSearch('')
        setAgentSearchQuery('')
        setAgentStatusFilter('')
        setAgentPriorityFilter('')
        setAgentCategoryFilter('')
        setAgentSort('newest')
        filteredAgentTicketsRequest.current = null
      }

      return (
        <div className="dashboard-page">
          <header className="dashboard-header">
            <div className="dashboard-header-inner">
              <a
                className="dashboard-brand"
                href={dashboardPath}
                onClick={(event) => navigate(event, dashboardPath)}
              >
                <BrandMark />
                <span>SupportFlow</span>
              </a>

              <div className="dashboard-header-actions">
                <NotificationCenter
                  onOpenTicket={handleNotificationTicketClick}
                  onUnauthorized={handleLogout}
                />
                <div className="dashboard-profile">
                  <span className="customer-avatar" aria-hidden="true">
                    {getUserInitials(agentName)}
                  </span>
                  <span className="customer-name">{agentName}</span>
                  <span className="role-label">Agent</span>
                </div>
                <button className="logout-button" type="button" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            </div>
          </header>

          <main className="dashboard-main">
            <section className="agent-welcome-section">
              <p className="dashboard-eyebrow">AGENT WORKSPACE</p>
              <h1>Agent Dashboard</h1>
              <p className="dashboard-subtitle">Manage your assigned customer tickets.</p>
            </section>

            <section className="agent-ticket-stats" aria-label="Assigned ticket statistics">
              {agentStats.map((stat) => (
                <article className="stat-card" key={stat.label}>
                  <div className={`stat-indicator ${stat.className}`} aria-hidden="true" />
                  <p>{stat.label}</p>
                  <strong>{stat.count}</strong>
                </article>
              ))}
            </section>

            {selectedAgentTicketId ? (
              <>
                <button
                  className="ticket-back-button"
                  type="button"
                  onClick={() => {
                    setSelectedAgentTicketId(null)
                    setAgentTicketDetails(null)
                    setAgentTicketDetailsStatus('idle')
                    setAgentComments([])
                    setAgentCommentsStatus('idle')
                    setAgentCommentDraft('')
                    setAgentCommentMessage(null)
                    agentCommentsRequest.current = null
                    agentTicketDetailsRequest.current = null
                  }}
                >
                  Back to Tickets
                </button>
                {agentTicketDetailsStatus === 'loading' ? (
                  <section className="ticket-details-card" role="status">
                    Loading ticket details…
                  </section>
                ) : agentTicketDetailsStatus === 'error' ? (
                  <section className="ticket-details-card ticket-details-error" role="alert">
                    <p>Unable to load this ticket. It may no longer be assigned to you.</p>
                    <button
                      className="retry-button"
                      type="button"
                      onClick={() => setAgentTicketDetailsAttempt((attempt) => attempt + 1)}
                    >
                      Try again
                    </button>
                  </section>
                ) : agentTicketDetails ? (
                  <section className="ticket-details-card" aria-labelledby="ticket-details-heading">
                    <div className="ticket-details-header">
                      <p className="dashboard-eyebrow">ASSIGNED TICKET</p>
                      <h2 id="ticket-details-heading">{agentTicketDetails.title}</h2>
                    </div>
                    <div className="ticket-details-grid">
                      <div className="ticket-detail-item">
                        <span>Category</span>
                        <strong>{agentTicketDetails.category || 'Not specified'}</strong>
                      </div>
                      <div className="ticket-detail-item">
                        <span>Priority</span>
                        <strong>{agentTicketDetails.priority || 'Not specified'}</strong>
                      </div>
                      <div className="ticket-detail-item">
                        <span>Status</span>
                        <strong>{agentTicketDetails.status?.replace('_', ' ') || 'Not specified'}</strong>
                      </div>
                      <div className="ticket-detail-item">
                        <span>Created</span>
                        <strong>
                          {agentTicketDetails.createdAt
                            ? new Date(agentTicketDetails.createdAt).toLocaleDateString()
                            : 'Date unavailable'}
                        </strong>
                      </div>
                      <div className="ticket-detail-item">
                        <span>Customer</span>
                        <strong>{agentTicketDetails.customer?.name || 'Customer unavailable'}</strong>
                      </div>
                      <div className="ticket-detail-item">
                        <span>Customer email</span>
                        <strong>{agentTicketDetails.customer?.email || 'Email unavailable'}</strong>
                      </div>
                    </div>
                    <div className="ticket-description">
                      <h3>Description</h3>
                      <p>{agentTicketDetails.description || 'No description provided.'}</p>
                    </div>
                    <form
                      className="agent-ticket-status-form"
                      onSubmit={handleAgentTicketStatusUpdate}
                    >
                      <label htmlFor="agent-ticket-status">Update Status</label>
                      <select
                        id="agent-ticket-status"
                        value={agentTicketStatusSelection}
                        onChange={(event) => setAgentTicketStatusSelection(event.target.value)}
                        disabled={isUpdatingAgentTicketStatus}
                        required
                      >
                        <option value="" disabled>Select a status</option>
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                      <button
                        className="create-ticket-button"
                        type="submit"
                        disabled={isUpdatingAgentTicketStatus || !agentTicketStatusSelection}
                      >
                        {isUpdatingAgentTicketStatus ? 'Updating…' : 'Update Status'}
                      </button>
                    </form>
                    {agentTicketStatusMessage && (
                      <p
                        className={`agent-ticket-status-message ${agentTicketStatusMessage.type}`}
                        role={agentTicketStatusMessage.type === 'error' ? 'alert' : 'status'}
                      >
                        {agentTicketStatusMessage.text}
                      </p>
                    )}
                    <section className="agent-conversation" aria-labelledby="agent-conversation-heading">
                      <div className="agent-conversation-header">
                        <h3 id="agent-conversation-heading">Conversation</h3>
                        <p>Communicate with the customer about this ticket.</p>
                      </div>
                      {agentCommentsStatus === 'loading' ? (
                        <p className="conversation-feedback" role="status">Loading conversation…</p>
                      ) : agentCommentsStatus === 'error' ? (
                        <div className="conversation-feedback conversation-error" role="alert">
                          <p>Unable to load the conversation.</p>
                          <button
                            className="retry-button"
                            type="button"
                            onClick={() => setAgentCommentsAttempt((attempt) => attempt + 1)}
                          >
                            Try again
                          </button>
                        </div>
                      ) : agentComments.length === 0 ? (
                        <p className="conversation-empty">No replies yet. Start the conversation below.</p>
                      ) : (
                        <div className="agent-comment-list" aria-live="polite">
                          {agentComments.map((comment) => (
                            <article className="agent-comment" key={comment._id}>
                              <div className="agent-comment-meta">
                                <strong>{comment.author?.name || 'SupportFlow user'}</strong>
                                {comment.author?.role && (
                                  <span className="agent-comment-role">{comment.author.role}</span>
                                )}
                                <time dateTime={comment.createdAt}>
                                  {comment.createdAt
                                    ? new Date(comment.createdAt).toLocaleString()
                                    : 'Date unavailable'}
                                </time>
                              </div>
                              <p>{comment.message}</p>
                            </article>
                          ))}
                        </div>
                      )}
                      {agentCommentMessage && (
                        <p
                          className={`agent-comment-message ${agentCommentMessage.type}`}
                          role={agentCommentMessage.type === 'error' ? 'alert' : 'status'}
                        >
                          {agentCommentMessage.text}
                        </p>
                      )}
                      <form className="agent-reply-form" onSubmit={handleAgentCommentSubmit}>
                        <label htmlFor="agent-reply">Your reply</label>
                        <textarea
                          id="agent-reply"
                          value={agentCommentDraft}
                          onChange={(event) => setAgentCommentDraft(event.target.value)}
                          placeholder="Write a reply to the customer…"
                          rows={4}
                          maxLength={5000}
                          disabled={isSendingAgentComment}
                          required
                        />
                        <button
                          className="create-ticket-button"
                          type="submit"
                          disabled={isSendingAgentComment || !agentCommentDraft.trim()}
                        >
                          {isSendingAgentComment ? 'Sending…' : 'Send Reply'}
                        </button>
                      </form>
                    </section>
                  </section>
                ) : null}
              </>
            ) : (
              <section className="recent-tickets-card" aria-labelledby="assigned-tickets-heading">
                <div className="recent-tickets-header">
                  <div>
                    <h2 id="assigned-tickets-heading">My Assigned Tickets</h2>
                    <p>Customer tickets assigned to you</p>
                  </div>
                </div>
                <div className="customer-ticket-controls">
                  <label className="customer-filter-field customer-search-field" htmlFor="agent-ticket-search">
                    <span>Search tickets by title</span>
                    <input
                      id="agent-ticket-search"
                      type="search"
                      maxLength={100}
                      value={agentSearch}
                      onChange={(event) => setAgentSearch(event.target.value)}
                      placeholder="Search tickets by title"
                    />
                  </label>
                  <label className="customer-filter-field" htmlFor="agent-ticket-status-filter">
                    <span>Status</span>
                    <select
                      id="agent-ticket-status-filter"
                      value={agentStatusFilter}
                      onChange={(event) => setAgentStatusFilter(event.target.value)}
                    >
                      <option value="">All Statuses</option>
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </label>
                  <label className="customer-filter-field" htmlFor="agent-ticket-priority-filter">
                    <span>Priority</span>
                    <select
                      id="agent-ticket-priority-filter"
                      value={agentPriorityFilter}
                      onChange={(event) => setAgentPriorityFilter(event.target.value)}
                    >
                      <option value="">All Priorities</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </label>
                  <label className="customer-filter-field" htmlFor="agent-ticket-category-filter">
                    <span>Category</span>
                    <select
                      id="agent-ticket-category-filter"
                      value={agentCategoryFilter}
                      onChange={(event) => setAgentCategoryFilter(event.target.value)}
                    >
                      <option value="">All Categories</option>
                      <option value="technical">Technical</option>
                      <option value="billing">Billing</option>
                      <option value="account">Account</option>
                      <option value="general">General</option>
                    </select>
                  </label>
                  <label className="customer-filter-field" htmlFor="agent-ticket-sort">
                    <span>Sort by</span>
                    <select
                      id="agent-ticket-sort"
                      value={agentSort}
                      onChange={(event) => setAgentSort(event.target.value)}
                    >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                    </select>
                  </label>
                  {hasAgentTicketFilters && (
                    <button
                      className="customer-clear-filters"
                      type="button"
                      onClick={clearAgentTicketFilters}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
                {ticketsStatus === 'loading' ? (
                  <p className="tickets-feedback" role="status">Loading assigned tickets…</p>
                ) : ticketsStatus === 'error' ? (
                  <div className="tickets-feedback tickets-error" role="alert">
                    <p>Unable to load your assigned tickets. Please try again.</p>
                    <button
                      className="retry-button"
                      type="button"
                      onClick={() => setTicketsAttempt((attempt) => attempt + 1)}
                    >
                      Try again
                    </button>
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="agent-empty-state">
                    <h3>No tickets assigned yet</h3>
                    <p>Tickets assigned to you will appear here.</p>
                  </div>
                ) : hasAgentTicketFilters &&
                  (isAgentSearchPending || filteredAgentTicketsStatus === 'loading' ||
                    filteredAgentTicketsStatus === 'idle') ? (
                  <p className="tickets-feedback" role="status">Loading assigned tickets…</p>
                ) : hasAgentTicketFilters && filteredAgentTicketsStatus === 'error' ? (
                  <div className="tickets-feedback tickets-error" role="alert">
                    <p>Unable to load matching assigned tickets. Please try again.</p>
                    <button
                      className="retry-button"
                      type="button"
                      onClick={() => {
                        filteredAgentTicketsRequest.current = null
                        setFilteredAgentTicketsAttempt((attempt) => attempt + 1)
                      }}
                    >
                      Try again
                    </button>
                  </div>
                ) : hasAgentTicketFilters && filteredAgentTickets.length === 0 ? (
                  <div className="customer-no-matching-tickets">
                    <p>No matching tickets found.</p>
                    <button
                      className="customer-clear-filters"
                      type="button"
                      onClick={clearAgentTicketFilters}
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <div className="ticket-list">
                    {(hasAgentTicketFilters ? filteredAgentTickets : tickets).map((ticket) => (
                      <article className="ticket-row agent-ticket-row" key={ticket._id}>
                        <div className="ticket-title">{ticket.title}</div>
                        <span className="ticket-category">{ticket.category}</span>
                        <span className={`ticket-priority priority-${ticket.priority}`}>
                          {ticket.priority}
                        </span>
                        <span className={`ticket-status status-${ticket.status}`}>
                          {ticket.status.replace('_', ' ')}
                        </span>
                        <span className="ticket-customer-name">
                          {ticket.customer?.name || 'Customer unavailable'}
                        </span>
                        <time dateTime={ticket.createdAt}>
                          {ticket.createdAt
                            ? new Date(ticket.createdAt).toLocaleDateString()
                            : 'Date unavailable'}
                        </time>
                        <button
                          className="agent-ticket-details-button"
                          type="button"
                          onClick={() => {
                            setAgentTicketDetails(null)
                            setAgentTicketDetailsStatus('loading')
                            setAgentTicketStatusMessage(null)
                            setAgentTicketStatusSelection('')
                            setAgentComments([])
                            setAgentCommentsStatus('idle')
                            setAgentCommentsAttempt(0)
                            setAgentCommentDraft('')
                            setAgentCommentMessage(null)
                            agentCommentsRequest.current = null
                            setSelectedAgentTicketId(ticket._id)
                          }}
                        >
                          View Details
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
          </main>
        </div>
      )
    }

    if (userRole === 'admin') {
      const adminName = currentUser?.name || 'Admin'
      const hasAdminTicketFilters = Boolean(
        adminSearch.trim() ||
        adminStatusFilter ||
        adminPriorityFilter ||
        adminCategoryFilter ||
        adminSort !== 'newest',
      )
      const isAdminSearchPending = adminSearch.trim() !== adminSearchQuery.trim()
      const clearAdminTicketFilters = () => {
        setAdminSearch('')
        setAdminSearchQuery('')
        setAdminStatusFilter('')
        setAdminPriorityFilter('')
        setAdminCategoryFilter('')
        setAdminSort('newest')
        filteredAdminTicketsRequest.current = null
      }
      const activeAgents = adminUsers.filter(
        (user) => user.role === 'agent' && user.isActive === true,
      )
      const employeeAgents = adminUsers.filter((user) => user.role === 'agent')
      const adminTicketStats = [
        { label: 'Total Tickets', count: adminTickets.length, className: 'total' },
        {
          label: 'Open Tickets',
          count: adminTickets.filter((ticket) => ticket.status === 'open').length,
          className: 'open',
        },
        {
          label: 'In Progress',
          count: adminTickets.filter((ticket) => ticket.status === 'in_progress').length,
          className: 'progress',
        },
        {
          label: 'Resolved',
          count: adminTickets.filter((ticket) => ticket.status === 'resolved').length,
          className: 'resolved',
        },
      ]
      const adminUserStats = [
        {
          label: 'Total Customers',
          count: adminUsers.filter((user) => user.role === 'customer').length,
          className: 'total',
        },
        {
          label: 'Total Agents',
          count: adminUsers.filter((user) => user.role === 'agent').length,
          className: 'progress',
        },
      ]
      const adminStatusAnalyticsItems = [
        { key: 'open', label: 'Open', count: Number(adminStatusAnalytics.open) || 0 },
        { key: 'in_progress', label: 'In progress', count: Number(adminStatusAnalytics.in_progress) || 0 },
        { key: 'resolved', label: 'Resolved', count: Number(adminStatusAnalytics.resolved) || 0 },
        { key: 'closed', label: 'Closed', count: Number(adminStatusAnalytics.closed) || 0 },
      ]
      const adminPriorityAnalyticsItems = [
        { key: 'low', label: 'Low', count: Number(adminPriorityAnalytics.low) || 0 },
        { key: 'medium', label: 'Medium', count: Number(adminPriorityAnalytics.medium) || 0 },
        { key: 'high', label: 'High', count: Number(adminPriorityAnalytics.high) || 0 },
        { key: 'urgent', label: 'Urgent', count: Number(adminPriorityAnalytics.urgent) || 0 },
      ]
      const adminCategoryAnalyticsItems = [
        { key: 'technical', label: 'Technical', count: Number(adminCategoryAnalytics.technical) || 0 },
        { key: 'billing', label: 'Billing', count: Number(adminCategoryAnalytics.billing) || 0 },
        { key: 'account', label: 'Account', count: Number(adminCategoryAnalytics.account) || 0 },
        { key: 'general', label: 'General', count: Number(adminCategoryAnalytics.general) || 0 },
      ]

      return (
        <div className="dashboard-page">
          <header className="dashboard-header">
            <div className="dashboard-header-inner">
              <a
                className="dashboard-brand"
                href={dashboardPath}
                onClick={(event) => navigate(event, dashboardPath)}
              >
                <BrandMark />
                <span>SupportFlow</span>
              </a>

              <div className="dashboard-header-actions">
                <NotificationCenter
                  onOpenTicket={handleNotificationTicketClick}
                  onUnauthorized={handleLogout}
                />
                <div className="dashboard-profile">
                  <span className="customer-avatar" aria-hidden="true">
                    {getUserInitials(adminName)}
                  </span>
                  <span className="customer-name">{adminName}</span>
                  <span className="role-label">Admin</span>
                </div>
                <button className="logout-button" type="button" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            </div>
          </header>

          <main className="dashboard-main">
            <section className="agent-welcome-section">
              <p className="dashboard-eyebrow">ADMIN WORKSPACE</p>
              <h1>Admin Dashboard</h1>
              <p className="dashboard-subtitle">
                Welcome, {adminName}. Monitor tickets and manage your support team.
              </p>
            </section>

            {adminDataStatus === 'loading' && (
              <p className="admin-data-feedback" role="status">Loading dashboard data…</p>
            )}
            {adminDataStatus === 'error' && (
              <div className="admin-data-feedback admin-data-error" role="alert">
                <p>Unable to load dashboard data. Please try again.</p>
                <button
                  className="retry-button"
                  type="button"
                  onClick={() => {
                    adminDataRequest.current = null
                    setAdminDataAttempt((attempt) => attempt + 1)
                  }}
                >
                  Try again
                </button>
              </div>
            )}

            <section className="admin-stats-section" aria-labelledby="admin-ticket-stats-heading">
              <div className="admin-section-heading">
                <h2 id="admin-ticket-stats-heading">Ticket Overview</h2>
              </div>
              <div className="admin-ticket-stats">
                {adminTicketStats.map((stat) => (
                  <article className="stat-card" key={stat.label}>
                    <div className={`stat-indicator ${stat.className}`} aria-hidden="true" />
                    <p>{stat.label}</p>
                    <strong>{stat.count}</strong>
                  </article>
                ))}
              </div>
            </section>

            <section className="admin-stats-section" aria-labelledby="admin-user-stats-heading">
              <div className="admin-section-heading">
                <h2 id="admin-user-stats-heading">User Overview</h2>
              </div>
              <div className="admin-user-stats">
                {adminUserStats.map((stat) => (
                  <article className="stat-card" key={stat.label}>
                    <div className={`stat-indicator ${stat.className}`} aria-hidden="true" />
                    <p>{stat.label}</p>
                    <strong>{stat.count}</strong>
                  </article>
                ))}
              </div>
            </section>

            <section className="admin-stats-section" aria-labelledby="admin-analytics-heading">
              <div className="admin-section-heading">
                <h2 id="admin-analytics-heading">Analytics</h2>
              </div>
              {adminAnalyticsStatus === 'loading' && (
                <p className="admin-data-feedback" role="status">Loading analytics…</p>
              )}
              {adminAnalyticsStatus === 'error' && (
                <div className="admin-data-feedback admin-data-error" role="alert">
                  <p>{adminAnalyticsError}</p>
                  <button
                    className="retry-button"
                    type="button"
                    onClick={() => {
                      setAdminAnalyticsError('')
                      setAdminAnalyticsStatus('loading')
                      setAdminAnalyticsAttempt((attempt) => attempt + 1)
                    }}
                  >
                    Retry analytics
                  </button>
                </div>
              )}
              {adminAnalyticsStatus === 'ready' && (
                <div className="analytics-grid">
                  <AnalyticsHorizontalBarChart
                    title="Tickets by status"
                    items={adminStatusAnalyticsItems}
                    variant="status"
                  />
                  <AnalyticsHorizontalBarChart
                    title="Tickets by priority"
                    items={adminPriorityAnalyticsItems}
                    variant="priority"
                  />
                  <AnalyticsHorizontalBarChart
                    title="Tickets by category"
                    items={adminCategoryAnalyticsItems}
                    variant="category"
                  />
                  <AnalyticsTrendChart trends={adminDailyTicketTrends} />
                  <AnalyticsAgentChart agents={adminAgentAnalytics} />
                </div>
              )}
            </section>

            {assignmentMessage && (
              <p
                className={`admin-assignment-message ${assignmentMessage.type}`}
                role={assignmentMessage.type === 'error' ? 'alert' : 'status'}
              >
                {assignmentMessage.text}
              </p>
            )}

            <div className="admin-content-grid">
              <section className="recent-tickets-card" aria-labelledby="admin-recent-tickets-heading">
                <div className="recent-tickets-header">
                  <div>
                    <h2 id="admin-recent-tickets-heading">Recent Tickets</h2>
                    <p>Latest support requests across the system</p>
                  </div>
                </div>
                {!selectedAdminTicketId && (
                  <div className="customer-ticket-controls admin-ticket-controls">
                    <label className="customer-filter-field customer-search-field" htmlFor="admin-ticket-search">
                      <span>Search tickets by title</span>
                      <input
                        id="admin-ticket-search"
                        type="search"
                        maxLength={100}
                        value={adminSearch}
                        onChange={(event) => setAdminSearch(event.target.value)}
                        placeholder="Search tickets by title"
                      />
                    </label>
                    <label className="customer-filter-field" htmlFor="admin-ticket-status-filter">
                      <span>Status</span>
                      <select
                        id="admin-ticket-status-filter"
                        value={adminStatusFilter}
                        onChange={(event) => setAdminStatusFilter(event.target.value)}
                      >
                        <option value="">All Statuses</option>
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </label>
                    <label className="customer-filter-field" htmlFor="admin-ticket-priority-filter">
                      <span>Priority</span>
                      <select
                        id="admin-ticket-priority-filter"
                        value={adminPriorityFilter}
                        onChange={(event) => setAdminPriorityFilter(event.target.value)}
                      >
                        <option value="">All Priorities</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </label>
                    <label className="customer-filter-field" htmlFor="admin-ticket-category-filter">
                      <span>Category</span>
                      <select
                        id="admin-ticket-category-filter"
                        value={adminCategoryFilter}
                        onChange={(event) => setAdminCategoryFilter(event.target.value)}
                      >
                        <option value="">All Categories</option>
                        <option value="technical">Technical</option>
                        <option value="billing">Billing</option>
                        <option value="account">Account</option>
                        <option value="general">General</option>
                      </select>
                    </label>
                    <label className="customer-filter-field" htmlFor="admin-ticket-sort">
                      <span>Sort by</span>
                      <select
                        id="admin-ticket-sort"
                        value={adminSort}
                        onChange={(event) => setAdminSort(event.target.value)}
                      >
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                      </select>
                    </label>
                    {hasAdminTicketFilters && (
                      <button
                        className="customer-clear-filters"
                        type="button"
                        onClick={clearAdminTicketFilters}
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                )}
                {selectedAdminTicketId ? (
                  <div className="admin-ticket-details-view">
                    <button
                      className="ticket-back-button"
                      type="button"
                      onClick={() => {
                        setSelectedAdminTicketId(null)
                        setAdminTicketDetails(null)
                        setAdminTicketComments([])
                        setAdminTicketDetailsStatus('idle')
                        setAdminTicketCommentsStatus('idle')
                        setAdminAssignmentMessage(null)
                        setAdminStatusMessage(null)
                      }}
                    >
                      Back to Tickets
                    </button>
                    {adminTicketDetailsStatus === 'loading' ? (
                      <p className="tickets-feedback" role="status">Loading ticket details…</p>
                    ) : adminTicketDetailsStatus === 'error' ? (
                      <div className="ticket-details-card ticket-details-error" role="alert">
                        <p>Unable to load ticket details.</p>
                        <button
                          className="retry-button"
                          type="button"
                          onClick={() => {
                            adminTicketDetailsRequest.current = null
                            setAdminTicketDetailsAttempt((attempt) => attempt + 1)
                          }}
                        >
                          Try again
                        </button>
                      </div>
                    ) : adminTicketDetailsStatus === 'ready' && adminTicketDetails ? (
                      <>
                        <article className="ticket-details-card">
                          <header className="ticket-details-header">
                            <p className="dashboard-eyebrow">TICKET DETAILS</p>
                            <h3>{adminTicketDetails.title}</h3>
                          </header>
                          <div className="ticket-details-grid">
                            <div className="ticket-detail-item">
                              <span>Category</span>
                              <strong>{adminTicketDetails.category || 'Unavailable'}</strong>
                            </div>
                            <div className="ticket-detail-item">
                              <span>Priority</span>
                              <strong>{adminTicketDetails.priority || 'Unavailable'}</strong>
                            </div>
                            <div className="ticket-detail-item">
                              <span>Status</span>
                              <strong>
                                {adminTicketDetails.status?.replaceAll('_', ' ') || 'Unavailable'}
                              </strong>
                            </div>
                            <div className="ticket-detail-item">
                              <span>Customer</span>
                              <strong>{adminTicketDetails.customer?.name || 'Unavailable'}</strong>
                            </div>
                            <div className="ticket-detail-item">
                              <span>Customer email</span>
                              <strong>{adminTicketDetails.customer?.email || 'Unavailable'}</strong>
                            </div>
                            <div className="ticket-detail-item">
                              <span>Assigned agent</span>
                              <strong>
                                {adminTicketDetails.assignedAgent?.name || 'Unassigned'}
                              </strong>
                            </div>
                            <div className="ticket-detail-item">
                              <span>Agent email</span>
                              <strong>
                                {adminTicketDetails.assignedAgent?.email || 'Unavailable'}
                              </strong>
                            </div>
                            <div className="ticket-detail-item">
                              <span>Created</span>
                              <strong>
                                {adminTicketDetails.createdAt
                                  ? new Date(adminTicketDetails.createdAt).toLocaleString()
                                  : 'Date unavailable'}
                              </strong>
                            </div>
                          </div>
                          <section className="ticket-description">
                            <h3>Description</h3>
                            <p>{adminTicketDetails.description || 'No description provided.'}</p>
                          </section>

                          <form
                            className="admin-assignment-form admin-detail-assignment-form"
                            onSubmit={handleAdminTicketAssignment}
                          >
                            <label htmlFor="admin-detail-agent-assignment">Assigned agent</label>
                            <select
                              id="admin-detail-agent-assignment"
                              name="agentId"
                              value={adminAssignmentSelection}
                              onChange={(event) => setAdminAssignmentSelection(event.target.value)}
                              disabled={isAdminAssigningTicket || activeAgents.length === 0}
                              required
                            >
                              <option value="">Select an active agent</option>
                              {activeAgents.map((agent) => (
                                <option key={agent.id} value={agent.id}>
                                  {agent.name}
                                </option>
                              ))}
                            </select>
                            <button
                              className="admin-assign-button"
                              type="submit"
                              disabled={isAdminAssigningTicket || activeAgents.length === 0}
                            >
                              {isAdminAssigningTicket ? 'Assigning…' : 'Change Assignment'}
                            </button>
                          </form>
                          {adminAssignmentMessage && (
                            <p
                              className={`admin-assignment-message ${adminAssignmentMessage.type}`}
                              role={adminAssignmentMessage.type === 'error' ? 'alert' : 'status'}
                            >
                              {adminAssignmentMessage.text}
                            </p>
                          )}

                          <form
                            className="agent-ticket-status-form"
                            onSubmit={handleAdminTicketStatusUpdate}
                          >
                            <label htmlFor="admin-ticket-status">Update status</label>
                            <select
                              id="admin-ticket-status"
                              value={adminStatusSelection}
                              onChange={(event) => setAdminStatusSelection(event.target.value)}
                              disabled={isAdminUpdatingStatus}
                              required
                            >
                              <option value="" disabled>Select a status</option>
                              <option value="open">Open</option>
                              <option value="in_progress">In Progress</option>
                              <option value="resolved">Resolved</option>
                              <option value="closed">Closed</option>
                            </select>
                            <button
                              className="admin-assign-button"
                              type="submit"
                              disabled={isAdminUpdatingStatus || !adminStatusSelection}
                            >
                              {isAdminUpdatingStatus ? 'Updating…' : 'Update Status'}
                            </button>
                          </form>
                          {adminStatusMessage && (
                            <p
                              className={`agent-ticket-status-message ${adminStatusMessage.type}`}
                              role={adminStatusMessage.type === 'error' ? 'alert' : 'status'}
                            >
                              {adminStatusMessage.text}
                            </p>
                          )}
                        </article>

                        <section
                          className="agent-conversation admin-ticket-conversation"
                          aria-labelledby="admin-ticket-conversation-heading"
                        >
                          <div className="agent-conversation-header">
                            <h3 id="admin-ticket-conversation-heading">Conversation</h3>
                            <p>Complete conversation between the customer and support team.</p>
                          </div>
                          {adminTicketCommentsStatus === 'loading' ? (
                            <p className="conversation-feedback" role="status">
                              Loading conversation…
                            </p>
                          ) : adminTicketCommentsStatus === 'error' ? (
                            <div className="conversation-feedback conversation-error" role="alert">
                              <p>Unable to load the conversation.</p>
                              <button
                                className="retry-button"
                                type="button"
                                onClick={() => {
                                  adminTicketCommentsRequest.current = null
                                  setAdminTicketCommentsAttempt((attempt) => attempt + 1)
                                }}
                              >
                                Try again
                              </button>
                            </div>
                          ) : adminTicketComments.length === 0 ? (
                            <p className="conversation-empty">No conversation messages yet.</p>
                          ) : (
                            <div className="agent-comment-list" aria-live="polite">
                              {adminTicketComments.map((comment) => (
                                <article className="agent-comment" key={comment._id}>
                                  <div className="agent-comment-meta">
                                    <strong>{comment.author?.name || 'SupportFlow user'}</strong>
                                    {comment.author?.role && (
                                      <span className="agent-comment-role">
                                        {comment.author.role}
                                      </span>
                                    )}
                                    <time dateTime={comment.createdAt}>
                                      {comment.createdAt
                                        ? new Date(comment.createdAt).toLocaleString()
                                        : 'Date unavailable'}
                                    </time>
                                  </div>
                                  <p>{comment.message}</p>
                                </article>
                              ))}
                            </div>
                          )}
                        </section>
                      </>
                    ) : null}
                  </div>
                ) : adminDataStatus === 'loading' ? (
                  <p className="tickets-feedback" role="status">Loading tickets…</p>
                ) : adminDataStatus === 'error' ? (
                  <div className="agent-empty-state">
                    <h3>Tickets unavailable</h3>
                    <p>Retry loading dashboard data to see recent tickets.</p>
                  </div>
                ) : adminTickets.length === 0 ? (
                  <div className="agent-empty-state">
                    <h3>No tickets yet</h3>
                    <p>New support tickets will appear here.</p>
                  </div>
                ) : hasAdminTicketFilters &&
                  (isAdminSearchPending || filteredAdminTicketsStatus === 'loading' ||
                    filteredAdminTicketsStatus === 'idle') ? (
                  <p className="tickets-feedback" role="status">Loading tickets…</p>
                ) : hasAdminTicketFilters && filteredAdminTicketsStatus === 'error' ? (
                  <div className="tickets-feedback tickets-error" role="alert">
                    <p>Unable to load matching tickets. Please try again.</p>
                    <button
                      className="retry-button"
                      type="button"
                      onClick={() => {
                        filteredAdminTicketsRequest.current = null
                        setFilteredAdminTicketsAttempt((attempt) => attempt + 1)
                      }}
                    >
                      Try again
                    </button>
                  </div>
                ) : hasAdminTicketFilters && filteredAdminTickets.length === 0 ? (
                  <div className="customer-no-matching-tickets">
                    <p>No matching tickets found.</p>
                    <button
                      className="customer-clear-filters"
                      type="button"
                      onClick={clearAdminTicketFilters}
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <div className="ticket-list">
                    {(hasAdminTicketFilters ? filteredAdminTickets : adminTickets).map((ticket) => (
                      <article className="ticket-row admin-ticket-row" key={ticket._id}>
                        <div className="ticket-title">{ticket.title}</div>
                        <span className="ticket-category">{ticket.category}</span>
                        <span className={`ticket-priority priority-${ticket.priority}`}>
                          {ticket.priority}
                        </span>
                        <span className={`ticket-status status-${ticket.status}`}>
                          {ticket.status.replace('_', ' ')}
                        </span>
                        <span className="ticket-customer-name">
                          {ticket.customer?.name || 'Customer unavailable'}
                        </span>
                        <span className="ticket-agent-name">
                          {ticket.assignedAgent?.name || 'Unassigned'}
                        </span>
                        <time dateTime={ticket.createdAt}>
                          {ticket.createdAt
                            ? new Date(ticket.createdAt).toLocaleDateString()
                            : 'Date unavailable'}
                        </time>
                        <button
                          className="agent-ticket-details-button"
                          type="button"
                          onClick={() => {
                            setAdminTicketDetails(null)
                            setAdminTicketComments([])
                            setAdminTicketDetailsStatus('loading')
                            setAdminTicketCommentsStatus('idle')
                            setAdminAssignmentMessage(null)
                            setAdminStatusMessage(null)
                            adminTicketDetailsRequest.current = null
                            adminTicketCommentsRequest.current = null
                            setSelectedAdminTicketId(ticket._id)
                          }}
                        >
                          View Details
                        </button>
                        <form
                          className="admin-assignment-form"
                          onSubmit={(event) => handleAssignTicket(event, ticket._id)}
                        >
                          <label htmlFor={`agent-assignment-${ticket._id}`}>Assign Agent</label>
                          <select
                            key={String(ticket.assignedAgent?._id || 'unassigned')}
                            id={`agent-assignment-${ticket._id}`}
                            name="agentId"
                            defaultValue={
                              activeAgents.some(
                                (agent) => String(agent.id) === String(ticket.assignedAgent?._id),
                              )
                                ? String(ticket.assignedAgent._id)
                                : ''
                            }
                            disabled={assigningTicketId !== null || activeAgents.length === 0}
                            required
                          >
                            <option value="">Select an active agent</option>
                            {activeAgents.map((agent) => (
                              <option key={agent.id} value={agent.id}>
                                {agent.name}
                              </option>
                            ))}
                          </select>
                          <button
                            className="admin-assign-button"
                            type="submit"
                            disabled={assigningTicketId !== null || activeAgents.length === 0}
                          >
                            {assigningTicketId === ticket._id ? 'Assigning…' : 'Assign'}
                          </button>
                        </form>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="recent-tickets-card" aria-labelledby="employee-management-heading">
                <div className="recent-tickets-header">
                  <div>
                    <h2 id="employee-management-heading">Employee Management</h2>
                    <p>Manage your support agents</p>
                  </div>
                </div>
                {adminDataStatus === 'loading' ? (
                  <p className="tickets-feedback" role="status">Loading agents…</p>
                ) : adminDataStatus === 'error' ? (
                  <div className="agent-empty-state">
                    <h3>Employee data unavailable</h3>
                    <p>Retry loading dashboard data to see active agents.</p>
                  </div>
                ) : employeeAgents.length === 0 ? (
                  <div className="agent-empty-state">
                    <h3>No agents yet</h3>
                    <p>Agent accounts will appear here.</p>
                  </div>
                ) : (
                  <>
                    {agentStatusMessage && (
                      <p
                        className={`admin-assignment-message ${agentStatusMessage.type}`}
                        role={agentStatusMessage.type === 'error' ? 'alert' : 'status'}
                      >
                        {agentStatusMessage.text}
                      </p>
                    )}
                    <div className="admin-agent-list">
                      {employeeAgents.map((agent) => (
                        <article
                          className="admin-agent-row"
                          key={`${agent.email}-${agent.createdAt}`}
                        >
                          <span className="customer-avatar" aria-hidden="true">
                            {getUserInitials(agent.name)}
                          </span>
                          <div className="admin-agent-details">
                            <strong>{agent.name}</strong>
                            <span>{agent.email}</span>
                          </div>
                          <span className={`role-label ${agent.isActive ? '' : 'inactive'}`}>
                            {agent.isActive ? 'Active' : 'Inactive'}
                          </span>
                          <button
                            className="admin-assign-button admin-agent-status-button"
                            type="button"
                            onClick={() => handleAgentStatusToggle(agent)}
                            disabled={updatingAgentStatusId !== null}
                            aria-label={`${agent.isActive ? 'Deactivate' : 'Activate'} ${agent.name}`}
                          >
                            {updatingAgentStatusId === agent.id
                              ? 'Updating…'
                              : agent.isActive
                                ? 'Deactivate'
                                : 'Activate'}
                          </button>
                        </article>
                      ))}
                    </div>
                  </>
                )}
              </section>
            </div>
          </main>
        </div>
      )
    }

    const hasCustomerTicketFilters = Boolean(
      customerSearch.trim() ||
      customerStatusFilter ||
      customerPriorityFilter ||
      customerCategoryFilter ||
      customerSort !== 'newest',
    )
    const isCustomerSearchPending = customerSearch.trim() !== customerSearchQuery.trim()
    const clearCustomerTicketFilters = () => {
      setCustomerSearch('')
      setCustomerSearchQuery('')
      setCustomerStatusFilter('')
      setCustomerPriorityFilter('')
      setCustomerCategoryFilter('')
      setCustomerSort('newest')
      filteredCustomerTicketsRequest.current = null
    }

    return (
      <div className="dashboard-page">
        <header className="dashboard-header">
          <div className="dashboard-header-inner">
            <a className="dashboard-brand" href={dashboardPath || '/dashboard'} onClick={(event) => navigate(event, dashboardPath || '/dashboard')}>
              <BrandMark />
              <span>SupportFlow</span>
            </a>

            <div className="dashboard-header-actions">
              <NotificationCenter
                onOpenTicket={handleNotificationTicketClick}
                onUnauthorized={handleLogout}
              />
              {dashboardStatus === 'ready' && (
                <div className="dashboard-profile">
                  <span className="customer-avatar" aria-hidden="true">
                    {getUserInitials(customerName)}
                  </span>
                  <span className="customer-name">{customerName}</span>
                </div>
              )}
              <button className="logout-button" type="button" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="dashboard-main">
          <section className="dashboard-welcome-section">
            <div>
              <p className="dashboard-eyebrow">CUSTOMER DASHBOARD</p>
              <h1>Welcome back, {customerName}!</h1>
              <p className="dashboard-subtitle">
                Keep track of your support requests and their latest updates.
              </p>
            </div>
            {!selectedCustomerTicketId && (
              <button
                className="create-ticket-button"
                type="button"
                onClick={() => {
                  setTicketMessage(null)
                  setIsTicketFormOpen(true)
                }}
              >
                <span aria-hidden="true">+</span>
                Create New Ticket
              </button>
            )}
          </section>

          {selectedCustomerTicketId ? (
            <>
              <button
                className="ticket-back-button"
                type="button"
                onClick={() => {
                  setSelectedCustomerTicketId(null)
                  setCustomerTicketDetails(null)
                  setCustomerTicketDetailsStatus('idle')
                  setCustomerComments([])
                  setCustomerCommentsStatus('idle')
                  setCustomerCommentDraft('')
                  setCustomerCommentMessage(null)
                  customerTicketDetailsRequest.current = null
                  customerCommentsRequest.current = null
                }}
              >
                Back to Tickets
              </button>
              {customerTicketDetailsStatus === 'loading' ? (
                <section className="ticket-details-card" role="status">
                  Loading ticket details…
                </section>
              ) : customerTicketDetailsStatus === 'error' ? (
                <section className="ticket-details-card ticket-details-error" role="alert">
                  <p>Unable to load this ticket. Please check your connection and try again.</p>
                  <button
                    className="retry-button"
                    type="button"
                    onClick={() => setCustomerTicketDetailsAttempt((attempt) => attempt + 1)}
                  >
                    Try again
                  </button>
                </section>
              ) : customerTicketDetails ? (
                <section className="ticket-details-card" aria-labelledby="customer-ticket-details-heading">
                  <div className="ticket-details-header">
                    <p className="dashboard-eyebrow">YOUR SUPPORT TICKET</p>
                    <h2 id="customer-ticket-details-heading">{customerTicketDetails.title}</h2>
                  </div>
                  <div className="ticket-details-grid">
                    <div className="ticket-detail-item">
                      <span>Category</span>
                      <strong>{customerTicketDetails.category || 'Not specified'}</strong>
                    </div>
                    <div className="ticket-detail-item">
                      <span>Priority</span>
                      <strong>{customerTicketDetails.priority || 'Not specified'}</strong>
                    </div>
                    <div className="ticket-detail-item">
                      <span>Status</span>
                      <strong>{customerTicketDetails.status?.replace('_', ' ') || 'Not specified'}</strong>
                    </div>
                    <div className="ticket-detail-item">
                      <span>Created</span>
                      <strong>
                        {customerTicketDetails.createdAt
                          ? new Date(customerTicketDetails.createdAt).toLocaleDateString()
                          : 'Date unavailable'}
                      </strong>
                    </div>
                    <div className="ticket-detail-item">
                      <span>Assigned agent</span>
                      <strong>
                        {customerTicketDetails.assignedAgent?.name || 'Not assigned yet'}
                      </strong>
                    </div>
                  </div>
                  <div className="ticket-description">
                    <h3>Description</h3>
                    <p>{customerTicketDetails.description || 'No description provided.'}</p>
                  </div>
                  <section
                    className="agent-conversation customer-conversation"
                    aria-labelledby="customer-conversation-heading"
                  >
                    <div className="agent-conversation-header">
                      <h3 id="customer-conversation-heading">Conversation</h3>
                      <p>Messages about your support ticket.</p>
                    </div>
                    {customerCommentsStatus === 'loading' ? (
                      <p className="conversation-feedback" role="status">Loading conversation…</p>
                    ) : customerCommentsStatus === 'error' ? (
                      <div className="conversation-feedback conversation-error" role="alert">
                        <p>Unable to load the conversation.</p>
                        <button
                          className="retry-button"
                          type="button"
                          onClick={() => setCustomerCommentsAttempt((attempt) => attempt + 1)}
                        >
                          Try again
                        </button>
                      </div>
                    ) : customerComments.length === 0 ? (
                      <p className="conversation-empty">No messages yet. Send a message to your support team.</p>
                    ) : (
                      <div className="agent-comment-list" aria-live="polite">
                        {customerComments.map((comment) => (
                          <article className="agent-comment" key={comment._id}>
                            <div className="agent-comment-meta">
                              <strong>{comment.author?.name || 'SupportFlow user'}</strong>
                              {comment.author?.role && (
                                <span className="agent-comment-role">{comment.author.role}</span>
                              )}
                              <time dateTime={comment.createdAt}>
                                {comment.createdAt
                                  ? new Date(comment.createdAt).toLocaleString()
                                  : 'Date unavailable'}
                              </time>
                            </div>
                            <p>{comment.message}</p>
                          </article>
                        ))}
                      </div>
                    )}
                    {customerCommentMessage && (
                      <p
                        className={`agent-comment-message ${customerCommentMessage.type}`}
                        role={customerCommentMessage.type === 'error' ? 'alert' : 'status'}
                      >
                        {customerCommentMessage.text}
                      </p>
                    )}
                    <form className="agent-reply-form" onSubmit={handleCustomerCommentSubmit}>
                      <label htmlFor="customer-reply">Your message</label>
                      <textarea
                        id="customer-reply"
                        value={customerCommentDraft}
                        onChange={(event) => setCustomerCommentDraft(event.target.value)}
                        placeholder="Write a message to your support team…"
                        rows={4}
                        maxLength={5000}
                        disabled={isSendingCustomerComment}
                        required
                      />
                      <button
                        className="create-ticket-button"
                        type="submit"
                        disabled={isSendingCustomerComment || !customerCommentDraft.trim()}
                      >
                        {isSendingCustomerComment ? 'Sending…' : 'Send Message'}
                      </button>
                    </form>
                  </section>
                </section>
              ) : null}
            </>
          ) : (
            <>
          {ticketMessage && (
            <p className={`ticket-form-message ${ticketMessage.type}`} role={ticketMessage.type === 'error' ? 'alert' : 'status'}>
              {ticketMessage.text}
            </p>
          )}

          {isTicketFormOpen && (
            <section className="ticket-create-card" aria-labelledby="create-ticket-heading">
              <div className="ticket-create-header">
                <h2 id="create-ticket-heading">Create New Ticket</h2>
                <p>Tell us what you need help with.</p>
              </div>
              <form className="ticket-create-form" onSubmit={handleTicketSubmit}>
                <div className="ticket-form-field">
                  <label htmlFor="ticket-title">Ticket Title</label>
                  <input
                    id="ticket-title"
                    name="ticket-title"
                    type="text"
                    maxLength={150}
                    required
                    disabled={isCreatingTicket}
                  />
                </div>
                <div className="ticket-form-field">
                  <label htmlFor="ticket-description">Description</label>
                  <textarea
                    id="ticket-description"
                    name="ticket-description"
                    rows={5}
                    required
                    disabled={isCreatingTicket}
                  />
                </div>
                <div className="ticket-form-actions">
                  <button className="create-ticket-button" type="submit" disabled={isCreatingTicket}>
                    {isCreatingTicket ? 'Submitting…' : 'Submit Ticket'}
                  </button>
                  <button
                    className="ticket-cancel-button"
                    type="button"
                    disabled={isCreatingTicket}
                    onClick={() => {
                      setIsTicketFormOpen(false)
                      setTicketMessage(null)
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          )}

          {formMessage?.type === 'info' && (
            <p className="dashboard-feedback" role="status">{formMessage.text}</p>
          )}

          <section className="ticket-stats" aria-label="Ticket statistics">
            {ticketStats.map((stat) => (
              <article className="stat-card" key={stat.label}>
                <div className={`stat-indicator ${stat.className}`} aria-hidden="true" />
                <p>{stat.label}</p>
                <strong>{stat.count}</strong>
              </article>
            ))}
          </section>

          <section className="recent-tickets-card" aria-labelledby="recent-tickets-heading">
            <div className="recent-tickets-header">
              <div>
                <h2 id="recent-tickets-heading">Recent Tickets</h2>
                <p>Your latest support requests</p>
              </div>
            </div>
            {!selectedCustomerTicketId && (
            <div className="customer-ticket-controls">
              <label className="customer-filter-field customer-search-field" htmlFor="customer-ticket-search">
                <span>Search tickets by title</span>
                <input
                  id="customer-ticket-search"
                  type="search"
                  maxLength={100}
                  value={customerSearch}
                  onChange={(event) => setCustomerSearch(event.target.value)}
                  placeholder="Search tickets by title"
                />
              </label>
              <label className="customer-filter-field" htmlFor="customer-ticket-status">
                <span>Status</span>
                <select
                  id="customer-ticket-status"
                  value={customerStatusFilter}
                  onChange={(event) => setCustomerStatusFilter(event.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </label>
              <label className="customer-filter-field" htmlFor="customer-ticket-priority">
                <span>Priority</span>
                <select
                  id="customer-ticket-priority"
                  value={customerPriorityFilter}
                  onChange={(event) => setCustomerPriorityFilter(event.target.value)}
                >
                  <option value="">All Priorities</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
              <label className="customer-filter-field" htmlFor="customer-ticket-category">
                <span>Category</span>
                <select
                  id="customer-ticket-category"
                  value={customerCategoryFilter}
                  onChange={(event) => setCustomerCategoryFilter(event.target.value)}
                >
                  <option value="">All Categories</option>
                  <option value="technical">Technical</option>
                  <option value="billing">Billing</option>
                  <option value="account">Account</option>
                  <option value="general">General</option>
                </select>
              </label>
              <label className="customer-filter-field" htmlFor="customer-ticket-sort">
                <span>Sort by</span>
                <select
                  id="customer-ticket-sort"
                  value={customerSort}
                  onChange={(event) => setCustomerSort(event.target.value)}
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </label>
              {hasCustomerTicketFilters && (
                <button
                  className="customer-clear-filters"
                  type="button"
                  onClick={clearCustomerTicketFilters}
                >
                  Clear filters
                </button>
              )}
            </div>
            )}
            {ticketsStatus === 'loading' ? (
            <p className="tickets-feedback" role="status">Loading your tickets…</p>
            ) : ticketsStatus === 'error' ? (
            <div className="tickets-feedback tickets-error" role="alert">
                <p>Unable to load your tickets. Please try again.</p>
                <button
                  className="retry-button"
                  type="button"
                  onClick={() => setTicketsAttempt((attempt) => attempt + 1)}
                >
                  Try again
                </button>
              </div>
            ) : tickets.length === 0 ? (
              <div className="tickets-empty-state">
                <span className="empty-state-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7a2.5 2.5 0 0 1-2.5 2.5h-4l-4 3v-3.1a2.5 2.5 0 0 1-3.5-2.4v-7Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M8.5 8.5h7M8.5 11.5h4.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <h3>No tickets yet</h3>
                <p>Your support requests will appear here once you create one.</p>
                <button
                  className="empty-state-button"
                  type="button"
                  onClick={() => {
                    setTicketMessage(null)
                    setIsTicketFormOpen(true)
                  }}
                >
                  Create your first ticket
                </button>
              </div>
            ) : hasCustomerTicketFilters &&
              (isCustomerSearchPending || filteredCustomerTicketsStatus === 'loading' ||
                filteredCustomerTicketsStatus === 'idle') ? (
              <p className="tickets-feedback" role="status">Loading your tickets…</p>
            ) : hasCustomerTicketFilters && filteredCustomerTicketsStatus === 'error' ? (
              <div className="tickets-feedback tickets-error" role="alert">
                <p>Unable to load matching tickets. Please try again.</p>
                <button
                  className="retry-button"
                  type="button"
                  onClick={() => {
                    filteredCustomerTicketsRequest.current = null
                    setFilteredCustomerTicketsAttempt((attempt) => attempt + 1)
                  }}
                >
                  Try again
                </button>
              </div>
            ) : hasCustomerTicketFilters && filteredCustomerTickets.length === 0 ? (
              <div className="customer-no-matching-tickets">
                <p>No matching tickets found.</p>
                <button
                  className="customer-clear-filters"
                  type="button"
                  onClick={clearCustomerTicketFilters}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="ticket-list">
                {(hasCustomerTicketFilters ? filteredCustomerTickets : tickets).map((ticket) => (
                  <article className="ticket-row customer-ticket-row" key={ticket._id}>
                    <div className="ticket-title">{ticket.title}</div>
                    <span className="ticket-category">{ticket.category}</span>
                    <span className={`ticket-priority priority-${ticket.priority}`}>
                      {ticket.priority}
                    </span>
                    <span className={`ticket-status status-${ticket.status}`}>
                      {ticket.status.replace('_', ' ')}
                    </span>
                    <time dateTime={ticket.createdAt}>
                      {ticket.createdAt
                        ? new Date(ticket.createdAt).toLocaleDateString()
                        : 'Date unavailable'}
                    </time>
                    <button
                      className="customer-ticket-details-button"
                      type="button"
                      onClick={() => {
                        setCustomerTicketDetails(null)
                        setCustomerTicketDetailsStatus('loading')
                        setCustomerComments([])
                        setCustomerCommentsStatus('idle')
                        setCustomerCommentDraft('')
                        setCustomerCommentMessage(null)
                        setCustomerCommentsAttempt(0)
                        customerTicketDetailsRequest.current = null
                        customerCommentsRequest.current = null
                        setSelectedCustomerTicketId(ticket._id)
                      }}
                    >
                      View Details
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
            </>
          )}
        </main>
      </div>
    )
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-label="SupportFlow account access">
        <a className="brand" href="/login" onClick={(event) => navigate(event, '/login')}>
          <BrandMark />
          <span>SupportFlow</span>
        </a>

        <div className="form-heading">
          <h1>{isRegister ? 'Create Your Account' : 'Welcome Back'}</h1>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegister && (
            <div className="field">
              <label htmlFor="full-name">Full name</label>
              <input
                id="full-name"
                name="name"
                type="text"
                placeholder="Full name"
                autoComplete="name"
                required
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <PasswordField
            id="password"
            label="Password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            showPassword={showPassword}
            onToggle={() => setShowPassword((visible) => !visible)}
          />

          {isRegister && (
            <PasswordField
              id="confirm-password"
              label="Confirm password"
              autoComplete="new-password"
              showPassword={showConfirmPassword}
              onToggle={() => setShowConfirmPassword((visible) => !visible)}
            />
          )}

          {formMessage && (
            <p className={`form-message ${formMessage.type}`} role={formMessage.type === 'error' ? 'alert' : 'status'}>
              {formMessage.text}
            </p>
          )}

          <button className="submit-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? (isRegister ? 'Registering…' : 'Logging in…') : isRegister ? 'Register' : 'Login'}
          </button>
        </form>

        <p className="switch-page">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <a
            href={isRegister ? '/login' : '/register'}
            onClick={(event) => navigate(event, isRegister ? '/login' : '/register')}
          >
            {isRegister ? 'Login' : 'Register'}
          </a>
        </p>
      </section>
    </main>
  )
}

export default App
