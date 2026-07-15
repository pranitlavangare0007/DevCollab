import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Github, X, ChevronRight, ChevronLeft, Lock,
  FileCode, Check, AlertCircle, Loader,
} from 'lucide-react'
import { useGitHub } from '../hooks/useGitHub'
import { PR_STATUS } from '../constants/prStatus'
import styles from './GitHubImportModal.module.css'

function PRBadge({ pr }) {
  const key = pr.merged ? 'merged' : pr.state
  const cfg = PR_STATUS[key] || PR_STATUS.closed
  const Icon = cfg.Icon
  return (
    <span className="badge" style={{ background: cfg.bg, color: cfg.color }}>
      <Icon size={10} />{cfg.label}
    </span>
  )
}

const FILE_STATUS_COLORS = {
  added:    { color: 'var(--success)', bg: '#0d2a10' },
  modified: { color: '#79c0ff',        bg: '#0c1f3a' },
  removed:  { color: 'var(--danger)',  bg: 'var(--danger-bg)' },
  renamed:  { color: 'var(--warn)',    bg: '#1c1810' },
}

const STEP_LABELS = ['Connect', 'Repos', 'PRs', 'Files']
const STEP_INDEX  = { connect: 0, repos: 1, prs: 2, files: 3 }
const NON_STEPPED = ['checking', 'connect', 'importing']

export default function GitHubImportModal({ onClose }) {
  const navigate = useNavigate()
  const gh       = useGitHub()

  // steps: checking | connect | repos | prs | files | importing
  const [step, setStep]                 = useState('checking')
  const [repos, setRepos]               = useState([])
  const [prs, setPRs]                   = useState([])
  const [files, setFiles]               = useState([])
  const [selectedRepo, setSelectedRepo] = useState(null)
  const [selectedPR, setSelectedPR]     = useState(null)
  const [search, setSearch]             = useState('')

  // On mount: check if already connected
  useEffect(() => {
    gh.getStatus().then(status => {
      if (status.connected) {
        loadRepos()
      } else {
        setStep('connect')
      }
    })
  }, [])

  const loadRepos = async () => {
    setStep('repos')
    const data = await gh.listRepos()
    setRepos(data)
  }

  const selectRepo = async (repo) => {
    setSelectedRepo(repo)
    setStep('prs')
    setSearch('')
    const data = await gh.listPRs(repo.fullName)
    setPRs(data)
  }

  const selectPR = async (pr) => {
    setSelectedPR(pr)
    setStep('files')
    const data = await gh.listPRFiles(selectedRepo.fullName, pr.number)
    setFiles(data)
  }

  const doImport = async (filename = null) => {
    setStep('importing')
    const result = await gh.importPR(selectedRepo.fullName, selectedPR.number, filename)
    if (result) {
      onClose()
      navigate(`/room/${result.roomId}`)
    } else {
      // error shown by hook — go back to file picker
      setStep('files')
    }
  }

  const stepIndex = STEP_INDEX[step] ?? 0

  const filteredRepos = repos.filter(r =>
    r.fullName.toLowerCase().includes(search.toLowerCase()))
  const filteredPRs = prs.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    String(p.number).includes(search))

  const showSteps  = !NON_STEPPED.includes(step)
  const showFooter = !NON_STEPPED.includes(step)

  const goBack = () => {
    if (step === 'repos') { onClose(); return }
    if (step === 'prs')   { setStep('repos'); setSearch(''); return }
    if (step === 'files') { setStep('prs');  setSearch(''); return }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={styles.header}>
          <Github size={18} color="var(--text-2)" />
          <div className={styles.title}>Import from GitHub</div>
          <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
        </div>

        {/* Step bar */}
        {showSteps && (
          <div className={styles.steps}>
            {STEP_LABELS.map((label, i) => (
              <div
                key={label}
                className={`${styles.stepItem} ${i === stepIndex ? styles.active : i < stepIndex ? styles.done : ''}`}
              >
                {label}
              </div>
            ))}
          </div>
        )}

        {/* Body */}
        <div className={styles.body}>

          {/* Checking */}
          {step === 'checking' && (
            <div className={styles.center}>
              <Loader size={24} color="var(--text-3)" className="spinner" />
              <div className={styles.loadingCaption}>Checking GitHub connection…</div>
            </div>
          )}

          {/* Connect */}
          {step === 'connect' && (
            <div className={styles.connectBox}>
              <Github size={40} color="var(--text-3)" />
              <div className={styles.connectTitle}>Connect your GitHub account</div>
              <div className={styles.connectDesc}>
                DevCollab needs read access to your repositories and pull requests.
                We never write or push anything to your repos.
              </div>
              <button className={styles.connectBtn} onClick={() => gh.connectGitHub()}>
                <Github size={16} /> Connect GitHub
              </button>
              <div className={styles.connectScopes}>
                Requires <code>repo</code> and <code>read:user</code> scopes
              </div>
            </div>
          )}

          {/* Repos */}
          {step === 'repos' && (
            <>
              {gh.error && (
                <div className="alert-error">
                  <AlertCircle size={14} />{gh.error}
                </div>
              )}
              <input
                className={`form-input ${styles.searchInput}`}
                placeholder="Search repositories…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />

              {gh.loading ? (
                <div className={styles.center}>
                  <Loader size={20} color="var(--text-3)" className="spinner" />
                </div>
              ) : filteredRepos.length === 0 ? (
                <div className={styles.emptyState}>No repositories found</div>
              ) : filteredRepos.map(r => (
                <div key={r.fullName} className={styles.item} onClick={() => selectRepo(r)}>
                  {r.isPrivate
                    ? <Lock size={14} color="var(--text-3)" />
                    : <FileCode size={14} color="var(--text-3)" />}
                  <div className={styles.itemBody}>
                    <div className={styles.itemTitle}>{r.fullName}</div>
                    <div className={styles.itemSubtitle}>Default branch: {r.defaultBranch}</div>
                  </div>
                  {r.isPrivate && (
                    <span
                      className="badge"
                      style={{ background: 'var(--bg-3)', color: 'var(--text-3)', border: '1px solid var(--border)' }}
                    >
                      Private
                    </span>
                  )}
                  <ChevronRight size={14} color="var(--text-3)" />
                </div>
              ))}
            </>
          )}

          {/* PRs */}
          {step === 'prs' && (
            <>
              {gh.error && <div className="alert-error"><AlertCircle size={14} />{gh.error}</div>}
              <div className={styles.repoSubline}>
                Pull requests in <strong className={styles.emphasis}>{selectedRepo?.fullName}</strong>
              </div>
              <input
                className={`form-input ${styles.searchInput}`}
                placeholder="Search pull requests…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />

              {gh.loading ? (
                <div className={styles.center}>
                  <Loader size={20} color="var(--text-3)" className="spinner" />
                </div>
              ) : filteredPRs.length === 0 ? (
                <div className={styles.emptyState}>No pull requests found</div>
              ) : filteredPRs.map(pr => {
                const isClosed = !pr.merged && pr.state === 'closed'
                return (
                  <div key={pr.number} className={styles.item} onClick={() => selectPR(pr)}>
                    <PRBadge pr={pr} />
                    <div className={styles.itemBody}>
                      <div className={styles.itemTitleTruncate}>#{pr.number} {pr.title}</div>
                      <div className={styles.itemSubtitle}>
                        by @{pr.authorLogin} · {pr.headRef} → {pr.baseRef}
                      </div>
                    </div>
                    {(isClosed || pr.merged) && (
                      <span className={styles.discussBadge}>Discuss in DevCollab</span>
                    )}
                    <ChevronRight size={14} color="var(--text-3)" className={styles.shrink0} />
                  </div>
                )
              })}
            </>
          )}

          {/* Files */}
          {step === 'files' && (
            <>
              {gh.error && <div className="alert-error"><AlertCircle size={14} />{gh.error}</div>}
              <div className={styles.repoSublineTight}>
                PR <strong className={styles.emphasis}>#{selectedPR?.number}: {selectedPR?.title}</strong>
              </div>
              <div className={styles.repoSublineSub}>
                Pick which file to open in the review editor
              </div>

              {/* Auto-select first file */}
              <div
                className={`${styles.fileItem} ${styles.fileItemRecommended}`}
                onClick={() => doImport(null)}
              >
                <Check size={14} color="var(--teal)" />
                <div>
                  <div className={styles.fileItemRecommendedTitle}>
                    Import first changed file (recommended)
                  </div>
                  <div className={styles.fileItemRecommendedDesc}>
                    Auto-selects the best file from this PR
                  </div>
                </div>
              </div>

              <div className={styles.dividerRow}>
                <span className={styles.dividerLine} />
                or pick a specific file
                <span className={styles.dividerLine} />
              </div>

              {gh.loading ? (
                <div className={styles.center}>
                  <Loader size={20} color="var(--text-3)" className="spinner" />
                </div>
              ) : files.map(f => {
                const sc = FILE_STATUS_COLORS[f.status] || FILE_STATUS_COLORS.modified
                return (
                  <div key={f.filename} className={styles.fileItem} onClick={() => doImport(f.filename)}>
                    <FileCode size={14} color="var(--text-3)" />
                    <div className={styles.itemBody}>
                      <div className={styles.filePath}>{f.filename}</div>
                      <div className={styles.fileStats}>+{f.additions} -{f.deletions}</div>
                    </div>
                    <span className="badge" style={{ background: sc.bg, color: sc.color }}>
                      {f.status}
                    </span>
                  </div>
                )
              })}
            </>
          )}

          {/* Importing */}
          {step === 'importing' && (
            <div className={styles.center}>
              <Loader size={28} color="var(--teal)" className="spinner" />
              <div className={styles.importingTitle}>Importing PR…</div>
              <div className={styles.importingDesc}>
                Fetching code from GitHub and creating review room
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {showFooter && (
          <div className={styles.footer}>
            <button className="btn btn-outline" onClick={goBack}>
              <ChevronLeft size={14} />
              {step === 'repos' ? 'Cancel' : 'Back'}
            </button>
            <span className={styles.footerCount}>
              {step === 'repos' && `${filteredRepos.length} repositories`}
              {step === 'prs'   && `${filteredPRs.length} pull requests`}
              {step === 'files' && `${files.length} changed files`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
