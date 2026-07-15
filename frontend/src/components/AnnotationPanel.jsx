import { useState, useRef, useEffect } from 'react'
import { MessageSquare } from 'lucide-react'
import AnnotationThread from './AnnotationThread'
import styles from './AnnotationPanel.module.css'

const FILTERS = ['All', 'Open', 'Resolved']

export default function AnnotationPanel({
  annotations = [],
  selectedLine,
  userRole,
  currentUser,
  onSubmit,
  onResolve,
  onReply,
  onClearLine,
}) {
  const [comment, setComment] = useState('')
  const [filter, setFilter] = useState('All')
  const textareaRef = useRef(null)

  // Focus textarea when line selected
  useEffect(() => {
    if (selectedLine && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [selectedLine])

  const handleSubmit = () => {
    if (!comment.trim() || !selectedLine) return
    onSubmit(comment.trim())
    setComment('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit()
    if (e.key === 'Escape') { onClearLine(); setComment('') }
  }

  const filtered = annotations.filter(a => {
    if (filter === 'All') return true
    if (filter === 'Open') return a.status === 'OPEN'
    if (filter === 'Resolved') return a.status === 'RESOLVED' || a.status === 'WONT_FIX'
    return true
  }).sort((a, b) => a.lineNumber - b.lineNumber)

  const openCount = annotations.filter(a => a.status === 'OPEN').length

  return (
    <div className={styles.panel}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarTitle}>
          <MessageSquare size={13} color="var(--teal)" />
          Annotations
          {openCount > 0 && (
            <span className={styles.openCountBadge}>{openCount} open</span>
          )}
        </div>
        <div className={styles.filterRow}>
          {FILTERS.map(f => (
            <button
              key={f}
              className={`${styles.filterBtn} ${filter === f ? styles.active : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Annotation input */}
      {userRole !== 'VIEWER' && (
        <div className={styles.inputArea}>
          {selectedLine ? (
            <>
              <div className={styles.inputLabel}>
                ✏️ Commenting on line {selectedLine}
              </div>
              <textarea
                ref={textareaRef}
                className={styles.textarea}
                placeholder="Describe the issue or suggestion… (Ctrl+Enter to submit)"
                value={comment}
                onChange={e => setComment(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={3}
              />
              <div className={styles.btnRow}>
                <button className={styles.cancelBtn} onClick={() => { onClearLine(); setComment('') }}>
                  Cancel
                </button>
                <button className={styles.submitBtn} onClick={handleSubmit} disabled={!comment.trim()}>
                  Add comment
                </button>
              </div>
            </>
          ) : (
            <div className={styles.noLineHint}>
              👆 Click a line number in the editor to add an annotation
            </div>
          )}
        </div>
      )}

      {userRole === 'VIEWER' && (
        <div className={styles.hint}>You are a viewer — annotations are read-only</div>
      )}

      {/* Annotations list */}
      <div className={styles.list}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <MessageSquare size={28} className={styles.emptyIcon} />
            <div className={styles.emptyTitle}>No annotations yet</div>
            <div className={styles.emptySubtitle}>
              {userRole !== 'VIEWER'
                ? 'Click any line in the editor to start reviewing'
                : 'No annotations have been added yet'}
            </div>
          </div>
        ) : (
          filtered.map(annotation => (
            <AnnotationThread
              key={annotation.id}
              annotation={annotation}
              currentUser={currentUser}
              userRole={userRole}
              onResolve={onResolve}
              onReply={onReply}
            />
          ))
        )}
      </div>
    </div>
  )
}
