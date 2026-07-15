import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LogOut, Plus, Users, Code, Clock, ChevronRight,
  Hash, Trash2, Github, GitPullRequest
} from 'lucide-react'
import api from '../api/axiosInstance'
import { useGitHub } from '../hooks/useGitHub'
import GitHubImportModal from '../components/GitHubImportModal'
import { PR_STATUS } from '../constants/prStatus'
import styles from './DashboardPage.module.css'

const LANGUAGES = ['javascript', 'typescript', 'java', 'python', 'go', 'rust', 'cpp',
  'csharp', 'html', 'css', 'sql', 'json', 'yaml', 'markdown', 'plaintext']

const roleBadge = role => ({
  OWNER:    { bg: '#1a2d1a', color: 'var(--success)' },
  REVIEWER: { bg: '#1a2040', color: '#79c0ff' },
  VIEWER:   { bg: '#2d2d1a', color: 'var(--warn)' },
}[role] || { bg: 'var(--bg-3)', color: 'var(--text-2)' })

function GitHubPRBadge({ status }) {
  if (!status) return null
  const cfg = PR_STATUS[status] || PR_STATUS.closed
  const Icon = cfg.Icon
  return (
    <span className="badge" style={{ background: cfg.bg, color: cfg.color }}>
      <Icon size={10} />{cfg.label}
    </span>
  )
}

export default function DashboardPage() {
  const [rooms, setRooms]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [createForm, setCreateForm]   = useState({ title: '', language: 'javascript' })
  const [joinCode, setJoinCode]       = useState('')
  const [createErr, setCreateErr]     = useState('')
  const [joinErr, setJoinErr]         = useState('')
  const [creating, setCreating]       = useState(false)
  const [joining, setJoining]         = useState(false)
  const [confirmRoom, setConfirmRoom] = useState(null)
  const [deleting, setDeleting]       = useState(false)
  const [showImport, setShowImport]   = useState(false)
  const [ghConnected, setGhConnected] = useState(false)
  const navigate = useNavigate()
  const gh = useGitHub()
  const user = JSON.parse(sessionStorage.getItem('dc_user') || '{}')

  useEffect(() => {
    fetchRooms()
    gh.getStatus().then(setGhConnected)
    // Handle GitHub OAuth redirect back from backend
    // Backend redirects to /?github=connected  or  /?github=error
    const params = new URLSearchParams(window.location.search)
    const githubResult = params.get('github')
    if (githubResult === 'connected') {
      window.history.replaceState({}, '', '/')
      setGhConnected(true)
      setShowImport(true) // open import modal automatically
    } else if (githubResult === 'error') {
      const reason = params.get('reason') || 'Unknown error'
      window.history.replaceState({}, '', '/')
      alert('GitHub connection failed: ' + reason)
    }
  }, [])

  const fetchRooms = async () => {
    try { const { data } = await api.get('/rooms'); setRooms(data) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const createRoom = async e => {
    e.preventDefault()
    if (!createForm.title.trim()) return
    setCreateErr(''); setCreating(true)
    try {
      const { data } = await api.post('/rooms', {
        title: createForm.title,
        language: createForm.language,
        codeContent: `// ${createForm.title}\n// Start reviewing here...\n`,
      })
      navigate(`/room/${data.id}`)
    } catch (err) {
      setCreateErr(err.response?.data?.message || 'Failed to create room')
    } finally { setCreating(false) }
  }

  const joinRoom = async e => {
    e.preventDefault()
    if (!joinCode.trim()) return
    setJoinErr(''); setJoining(true)
    try {
      const { data } = await api.post('/rooms/join', { joinCode: joinCode.trim().toUpperCase() })
      navigate(`/room/${data.id}`)
    } catch (err) {
      setJoinErr(err.response?.data?.message || 'Invalid join code')
    } finally { setJoining(false) }
  }

  const confirmDelete = (e, room) => { e.stopPropagation(); setConfirmRoom(room) }

  const deleteRoom = async () => {
    if (!confirmRoom || deleting) return
    setDeleting(true)
    try {
      await api.delete(`/rooms/${confirmRoom.id}`)
      setRooms(prev => prev.filter(r => r.id !== confirmRoom.id))
      setConfirmRoom(null)
    } catch (err) { alert(err.response?.data?.message || 'Failed to archive room') }
    finally { setDeleting(false) }
  }

  const disconnectGH = async () => {
    await gh.disconnect(); setGhConnected(false)
  }

  const logout = () => {
    sessionStorage.removeItem('dc_token')
    sessionStorage.removeItem('dc_user')
    navigate('/login')
  }

  const activeRooms   = rooms.filter(r => r.status === 'ACTIVE')
  const archivedRooms = rooms.filter(r => r.status === 'ARCHIVED')

  return (
    <div className={styles.page}>

      {/* GitHub Import Modal */}
      {showImport && <GitHubImportModal onClose={() => { setShowImport(false); fetchRooms() }} />}

      {/* Confirm archive modal */}
      {confirmRoom && (
        <div className="overlay" onClick={() => setConfirmRoom(null)}>
          <div className="confirm-box" onClick={e => e.stopPropagation()}>
            <div className="confirm-title">Archive this room?</div>
            <div className="confirm-text">
              "<strong>{confirmRoom.title}</strong>" will be archived and hidden from active rooms.
              All annotations are preserved.
            </div>
            <div className="confirm-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmRoom(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={deleteRoom} disabled={deleting}>
                <Trash2 size={13} />
                {deleting ? 'Archiving…' : 'Archive room'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className={styles.nav}>
        <div className={styles.navLeft}>
          <div className={styles.logoIcon}>DC</div>
          <span className={styles.logoText}>DevCollab</span>
        </div>
        <div className={styles.navRight}>
          {/* GitHub connect/disconnect */}
          {ghConnected ? (
            <button className={`${styles.ghNavBtn} ${styles.connected}`} onClick={disconnectGH} title="Disconnect GitHub">
              <Github size={14} color="var(--success)" /> Connected
            </button>
          ) : (
            <button className={styles.ghNavBtn} onClick={() => setShowImport(true)}>
              <Github size={14} /> Connect GitHub
            </button>
          )}
          <span className={styles.username}>@{user.username}</span>
          <button className={styles.logoutBtn} onClick={logout}>
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </nav>

      <main className={styles.main}>

        {/* GitHub import banner */}
        {ghConnected && (
          <div className={styles.ghBanner}>
            <Github size={18} color="#6e40c9" />
            <div className={styles.ghBannerBody}>
              <div className={styles.ghBannerTitle}>GitHub connected</div>
              <div className={styles.ghBannerSubtitle}>
                Import any pull request — open, closed, or merged — directly into a review room
              </div>
            </div>
            <button className="btn btn-dark" onClick={() => setShowImport(true)}>
              <GitPullRequest size={13} /> Import PR
            </button>
          </div>
        )}

        {/* Create + Join row */}
        <div className={styles.formsGrid}>

          {/* Create */}
          <div className={styles.panel}>
            <div className={styles.panelTitle}>Create a review room</div>
            {createErr && <div className="alert-error">{createErr}</div>}
            <form onSubmit={createRoom}>
              <div className={styles.fieldGroupTight}>
                <input
                  className="form-input"
                  placeholder="Room title (e.g. PR #42 review)"
                  value={createForm.title}
                  onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>
              <div className={styles.fieldGroup}>
                <select
                  className="form-select"
                  value={createForm.language}
                  onChange={e => setCreateForm(f => ({ ...f, language: e.target.value }))}
                >
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className={styles.createActions}>
                <button className={`btn btn-primary ${styles.createSubmit}`} disabled={creating} type="submit">
                  <Plus size={15} /> {creating ? 'Creating…' : 'Create room'}
                </button>
                {ghConnected && (
                  <button
                    type="button"
                    className={`btn btn-dark ${styles.ghImportIconBtn}`}
                    title="Import from GitHub"
                    onClick={() => setShowImport(true)}
                  >
                    <Github size={15} />
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Join */}
          <div className={styles.panel}>
            <div className={styles.panelTitle}>Join an existing room</div>
            {joinErr && <div className="alert-error">{joinErr}</div>}
            <form onSubmit={joinRoom}>
              <div className={styles.fieldGroup}>
                <div className={styles.joinHint}>
                  Enter the 6-character room code shared with you
                </div>
                <input
                  className={`form-input ${styles.joinInput}`}
                  placeholder="ABC123"
                  maxLength={6}
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                />
              </div>
              <button className={`btn btn-outline ${styles.joinSubmit}`} disabled={joining} type="submit">
                <ChevronRight size={15} /> {joining ? 'Joining…' : 'Join room'}
              </button>
            </form>
          </div>
        </div>

        {/* Active rooms */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <Code size={16} color="var(--teal)" />
            Active rooms
            <span className={styles.sectionCount}>({activeRooms.length})</span>
          </div>
          {loading ? (
            <div className={styles.loadingState}>Loading…</div>
          ) : activeRooms.length === 0 ? (
            <div className={styles.emptyState}>
              <Code size={32} className={styles.emptyIcon} />
              <div>No active rooms yet.</div>
              <div className={styles.emptyStateSubtitle}>
                {ghConnected ? 'Create a room or import a PR from GitHub above.' : 'Create one above to get started.'}
              </div>
            </div>
          ) : (
            <div className={styles.grid}>
              {activeRooms.map(r => {
                const rb = roleBadge(r.role)
                const isOwner = r.role === 'OWNER'
                return (
                  <div key={r.id} className={styles.card} onClick={() => navigate(`/room/${r.id}`)}>

                    {isOwner && (
                      <button className={styles.deleteBtn} title="Archive room" onClick={e => confirmDelete(e, r)}>
                        <Trash2 size={14} />
                      </button>
                    )}

                    {/* GitHub PR banner on card */}
                    {r.githubPrUrl && (
                      <div className={styles.cardPrRow}>
                        <Github size={11} />
                        <span className={styles.cardPrRepo}>{r.githubRepo} #{r.githubPrNumber}</span>
                        <GitHubPRBadge status={r.githubPrStatus} />
                      </div>
                    )}

                    <div className={styles.cardTopRow}>
                      <div className={styles.cardTitle}>{r.title}</div>
                      <span className={`badge ${styles.cardBadge}`} style={{ background: rb.bg, color: rb.color }}>
                        {r.role}
                      </span>
                    </div>
                    <div className={styles.cardMeta}>
                      <span className={styles.cardMetaItem}>
                        <Code size={11} />{r.language}
                      </span>
                      <span className={styles.cardMetaItem}>
                        <Hash size={11} />{r.joinCode}
                      </span>
                      <span className={styles.cardMetaItem}>
                        <Users size={11} />@{r.ownerUsername}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Archived rooms */}
        {archivedRooms.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <Clock size={16} color="var(--text-3)" />
              <span className={styles.mutedText}>Archived rooms</span>
              <span className={styles.sectionCount}>({archivedRooms.length})</span>
            </div>
            <div className={styles.grid}>
              {archivedRooms.map(r => (
                <div
                  key={r.id}
                  className={`${styles.card} ${styles.archived}`}
                  onClick={() => navigate(`/room/${r.id}`)}
                >
                  {r.githubPrUrl && (
                    <div className={styles.cardPrRow}>
                      <Github size={11} />
                      <span>{r.githubRepo} #{r.githubPrNumber}</span>
                    </div>
                  )}
                  <div className={styles.cardTitle}>{r.title}</div>
                  <div className={styles.cardMeta}>
                    <span>{r.language}</span>
                    <span className={styles.cardMetaMono}>#{r.joinCode}</span>
                    <span className="badge" style={{ background: 'var(--bg-3)', color: 'var(--text-3)' }}>
                      Archived
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
