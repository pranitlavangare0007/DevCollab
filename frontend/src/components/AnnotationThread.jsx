import { useState } from 'react'
import { CheckCircle, XCircle, RotateCcw, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'
import styles from './AnnotationThread.module.css'

const STATUS_CONFIG = {
  OPEN:     { color: '#79c0ff', bg: '#0c1f3a', label: 'Open' },
  RESOLVED: { color: 'var(--success)', bg: '#0d2a10', label: 'Resolved' },
  WONT_FIX: { color: 'var(--text-3)', bg: 'var(--bg-3)', label: "Won't fix" },
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function AnnotationThread({ annotation, currentUser, userRole, onResolve, onReply }) {
  const [showReplies, setShowReplies] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  const st = STATUS_CONFIG[annotation.status] || STATUS_CONFIG.OPEN
  const canAct = userRole !== 'VIEWER'
  const replies = annotation.replies || []

  const handleReply = async () => {
    if (!replyText.trim() || sendingReply) return
    setSendingReply(true)
    try {
      onReply(annotation.id, replyText.trim())
      setReplyText('')
    } finally {
      setSendingReply(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleReply()
  }

  return (
    <div className={styles.thread}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.topRow}>
          <span className={styles.lineBadge}>L{annotation.lineNumber}</span>
          <span className={styles.author}>@{annotation.authorUsername}</span>
          <span
            className={styles.statusBadge}
            style={{ '--status-bg': st.bg, '--status-color': st.color }}
          >
            {st.label}
          </span>
          <span className={styles.time}>{timeAgo(annotation.createdAt)}</span>
        </div>
        <div className={styles.comment}>{annotation.comment}</div>

        {/* Action buttons */}
        {canAct && (
          <div className={styles.actions}>
            {annotation.status === 'OPEN' && (
              <>
                <button
                  className={`${styles.actionBtn} ${styles.resolve}`}
                  onClick={() => onResolve(annotation.id, 'RESOLVED')}
                >
                  <CheckCircle size={11} color="var(--success)" /> Resolve
                </button>
                <button
                  className={`${styles.actionBtn} ${styles.wontFix}`}
                  onClick={() => onResolve(annotation.id, 'WONT_FIX')}
                >
                  <XCircle size={11} /> Won't fix
                </button>
              </>
            )}
            {(annotation.status === 'RESOLVED' || annotation.status === 'WONT_FIX') && (
              <button
                className={`${styles.actionBtn} ${styles.reopen}`}
                onClick={() => onResolve(annotation.id, 'OPEN')}
              >
                <RotateCcw size={11} color="var(--warn)" /> Reopen
              </button>
            )}
          </div>
        )}
      </div>

      {/* Replies */}
      {(replies.length > 0 || canAct) && (
        <div className={styles.repliesSection}>
          {replies.length > 0 && (
            <button className={styles.repliesToggle} onClick={() => setShowReplies(s => !s)}>
              <MessageSquare size={11} />
              {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              {showReplies
                ? <ChevronUp size={11} className={styles.chevron} />
                : <ChevronDown size={11} className={styles.chevron} />}
            </button>
          )}

          {showReplies && replies.map((r) => (
            <div key={r.id} className={styles.reply}>
              <div className={styles.replyAuthor}>@{r.authorUsername}</div>
              <div className={styles.replyText}>{r.content}</div>
            </div>
          ))}

          {canAct && (
            <div className={styles.replyInput}>
              <textarea
                className={styles.replyTextarea}
                placeholder="Reply… (Ctrl+Enter to send)"
                value={replyText}
                rows={1}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button className={styles.sendBtn} onClick={handleReply} disabled={sendingReply}>
                Send
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
