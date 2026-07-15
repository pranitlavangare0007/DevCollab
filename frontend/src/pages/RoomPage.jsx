import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import {
  ArrowLeft, Copy, Check, Users, Wifi, WifiOff,
  Code, Archive, Github, ExternalLink
} from 'lucide-react'
import api from '../api/axiosInstance'
import { useWebSocket } from '../hooks/useWebSocket'
import AnnotationPanel from '../components/AnnotationPanel'
import PresenceBar from '../components/PresenceBar'
import { PR_STATUS } from '../constants/prStatus'
import styles from './RoomPage.module.css'

export default function RoomPage() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const user     = JSON.parse(sessionStorage.getItem('dc_user') || '{}')

  const [room, setRoom]                     = useState(null)
  const [code, setCode]                     = useState('')          // live editor code
  const [annotations, setAnnotations]       = useState([])
  const [onlineUsers, setOnlineUsers]       = useState([])
  const [selectedLine, setSelectedLine]     = useState(null)
  const [loading, setLoading]               = useState(true)
  const [wsConnected, setWsConnected]       = useState(false)
  const [copied, setCopied]                 = useState(false)
  const [userRole, setUserRole]             = useState('REVIEWER')
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [archiving, setArchiving]           = useState(false)
  const [syncing, setSyncing]               = useState(false)       // code save indicator

  // Debounce timer ref — avoid sending on every keystroke
  const debounceRef  = useRef(null)
  // Track whether code change came from remote (to avoid echo)
  const remoteUpdate = useRef(false)
  const editorRef    = useRef(null)

  // ── load room data ────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [roomRes, annRes, membersRes] = await Promise.all([
          api.get(`/rooms/${id}`),
          api.get(`/rooms/${id}/annotations`),
          api.get(`/rooms/${id}/members`),
        ])
        setRoom(roomRes.data)
        setCode(roomRes.data.codeContent || '')
        setAnnotations(annRes.data)
        const me = membersRes.data.find(m => m.username === user.username)
        if (me) setUserRole(me.role)
      } catch {
        navigate('/')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  // ── WebSocket callbacks ───────────────────────────────────────────────────

  const onAnnotation = useCallback((a) => {
    setAnnotations(prev =>
      prev.find(x => x.id === a.id) ? prev : [...prev, a])
  }, [])

  const onStatus = useCallback((updated) => {
    setAnnotations(prev => prev.map(a => a.id === updated.id ? updated : a))
  }, [])

  const onReply = useCallback((reply) => {
    setAnnotations(prev => prev.map(a =>
      a.id === reply.annotationId
        ? { ...a, replies: [...(a.replies || []).filter(r => r.id !== reply.id), reply] }
        : a
    ))
  }, [])

  const onPresence = useCallback((p) => {
    setOnlineUsers(prev => {
      const filtered = prev.filter(u => u.username !== p.username)
      return p.status === 'ONLINE' ? [...filtered, p] : filtered
    })
  }, [])

  // Receive code update from another user
  const onCodeUpdate = useCallback((msg) => {
    // skip if this update came from the current user (echo prevention)
    if (msg.updatedBy === user.username) return
    console.log('[WS] code update from', msg.updatedBy)
    remoteUpdate.current = true   // flag so onChange doesn't re-send
    setCode(msg.codeContent)
  }, [user.username])

  const { sendAnnotation, sendReply, sendCodeUpdate } = useWebSocket(id, {
    onAnnotation,
    onStatus,
    onReply,
    onPresence,
    onCodeUpdate,
    onConnect: () => setWsConnected(true),
  })

  // ── editor handlers ───────────────────────────────────────────────────────

  const handleEditorMount = (editor) => {
    editorRef.current = editor
    // Click on line number → select line for annotation
    editor.onMouseDown(e => {
      if (e.target?.position) {
        setSelectedLine(e.target.position.lineNumber)
      }
    })
  }

  const handleCodeChange = useCallback((newValue) => {
    // If this change came from a remote WS update, don't re-broadcast
    if (remoteUpdate.current) {
      remoteUpdate.current = false
      setCode(newValue)
      return
    }

    setCode(newValue)
    setSyncing(true)

    // Debounce: only send after user stops typing for 600ms
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      sendCodeUpdate(newValue)
      setSyncing(false)
    }, 600)
  }, [sendCodeUpdate])

  // ── annotation actions ────────────────────────────────────────────────────

  const submitAnnotation = (comment) => {
    if (!selectedLine || !comment.trim()) return
    sendAnnotation(selectedLine, comment)
    setSelectedLine(null)
  }

  const handleResolve = async (annotationId, status) => {
    try {
      await api.patch(`/annotations/${annotationId}/status`, { status })
    } catch (e) { console.error(e) }
  }

  // ── archive ───────────────────────────────────────────────────────────────

  const archiveRoom = async () => {
    setArchiving(true)
    try {
      await api.delete(`/rooms/${id}`)
      navigate('/')
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to archive')
    } finally {
      setArchiving(false)
      setConfirmArchive(false)
    }
  }

  // ── copy join code ────────────────────────────────────────────────────────

  const copyJoinCode = async () => {
    if (!room) return
    await navigator.clipboard.writeText(room.joinCode).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={`${styles.page} ${styles.centered}`}>
        <div className={styles.loadingText}>Loading room…</div>
      </div>
    )
  }
  if (!room) return null

  const canEdit  = userRole === 'OWNER' || userRole === 'REVIEWER'
  const prStatus = room.githubPrStatus
  const prCfg    = PR_STATUS[prStatus] || null
  const PrIcon   = prCfg?.Icon

  return (
    <div className={styles.page}>

      {/* ── Archive confirm ── */}
      {confirmArchive && (
        <div className="overlay" onClick={() => setConfirmArchive(false)}>
          <div className="confirm-box" onClick={e => e.stopPropagation()}>
            <div className="confirm-title">Archive this room?</div>
            <div className="confirm-text">
              "<strong>{room.title}</strong>" will be archived. All annotations are preserved.
            </div>
            <div className="confirm-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmArchive(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={archiveRoom} disabled={archiving}>
                <Archive size={13} />
                {archiving ? 'Archiving…' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Nav ── */}
      <nav className={styles.nav}>
        <div className={styles.navLeft}>
          <button className={styles.backBtn} onClick={() => navigate('/')}>
            <ArrowLeft size={15} /> Back
          </button>
          <span className={styles.divider}>|</span>
          <span className={styles.roomTitle}>{room.title}</span>
          <span className={styles.langBadge}>{room.language}</span>
        </div>

        <div className={styles.navRight}>
          {/* Sync indicator */}
          {canEdit && (
            <div className={styles.syncStatus}>
              {syncing
                ? <><div className={`${styles.syncDot} ${styles.syncing}`} />Syncing…</>
                : wsConnected
                  ? <><div className={`${styles.syncDot} ${styles.saved}`} />Saved</>
                  : null}
            </div>
          )}

          {/* WS indicator */}
          <div className={`${styles.wsStatus} ${wsConnected ? styles.connected : styles.disconnected}`}>
            {wsConnected
              ? <><Wifi size={13} color="var(--success)" /><span>Live</span></>
              : <><WifiOff size={13} color="var(--text-3)" /><span>Connecting…</span></>}
          </div>

          {/* Online count */}
          <div className={styles.onlineCount}>
            <Users size={13} />{onlineUsers.length} online
          </div>

          {/* Join code */}
          <button className={styles.joinBadge} onClick={copyJoinCode} title="Copy join code">
            <Code size={12} />
            <span className={styles.joinCodeText}>{room.joinCode}</span>
            {copied
              ? <Check size={12} color="var(--success)" />
              : <Copy size={12} />}
          </button>

          {/* Archive — owner only */}
          {userRole === 'OWNER' && (
            <button className={styles.archiveBtn} onClick={() => setConfirmArchive(true)}>
              <Archive size={13} /> Archive
            </button>
          )}
        </div>
      </nav>

      {/* ── GitHub PR banner ── */}
      {room.githubPrUrl && prCfg && (
        <div className={styles.ghBanner}>
          <Github size={14} color="#6e40c9" className={styles.ghIcon} />
          <span className="badge" style={{ background: prCfg.bg, color: prCfg.color }}>
            <PrIcon size={10} />{prCfg.label}
          </span>
          <span className={styles.ghBannerTitle}>
            #{room.githubPrNumber} {room.githubPrTitle}
          </span>
          <span className={styles.ghBannerMeta}>
            {room.githubRepo}
            {room.githubPrAuthor ? ` · @${room.githubPrAuthor}` : ''}
          </span>
          <a
            href={room.githubPrUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.ghLink}
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink size={11} /> View on GitHub
          </a>
        </div>
      )}

      {/* ── Body ── */}
      <div className={styles.body}>

        {/* Editor column */}
        <div className={styles.editorCol}>

          {/* Line selected hint */}
          {selectedLine && (
            <div className={styles.lineHint}>
              <span className={styles.lineHintText}>
                Line <strong>{selectedLine}</strong> selected
                — add your comment in the panel →
              </span>
              <button className={styles.lineHintClose} onClick={() => setSelectedLine(null)}>
                ✕
              </button>
            </div>
          )}

          <Editor
            height="100%"
            language={room.language || 'javascript'}
            value={code}
            theme="vs-dark"
            options={{
              readOnly: !canEdit,
              lineNumbers: 'on',
              minimap: { enabled: false },
              fontSize: 13,
              lineHeight: 20,
              padding: { top: 12 },
              scrollBeyondLastLine: false,
              renderLineHighlight: 'line',
              glyphMargin: false,
              folding: true,
              wordWrap: 'off',
              // Show annotation decorations in gutter
              overviewRulerLanes: 2,
            }}
            onMount={handleEditorMount}
            onChange={canEdit ? handleCodeChange : undefined}
          />
        </div>

        {/* Sidebar */}
        <div className={styles.sidePanel}>
          <PresenceBar users={onlineUsers} currentUser={user.username} />
          <AnnotationPanel
            annotations={annotations}
            selectedLine={selectedLine}
            userRole={userRole}
            currentUser={user.username}
            onSubmit={submitAnnotation}
            onResolve={handleResolve}
            onReply={sendReply}
            onClearLine={() => setSelectedLine(null)}
          />
        </div>
      </div>
    </div>
  )
}
