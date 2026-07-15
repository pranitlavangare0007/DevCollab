import styles from './PresenceBar.module.css'

const COLORS = [
  ['#1DB385', '#0d2818'], ['#79c0ff', '#0c1f3a'], ['#d29922', '#1c1810'],
  ['#f78166', '#2a1010'], ['#bc8cff', '#1a0d2e'], ['#56d364', '#0d2a10'],
]

function getColor(username) {
  let h = 0
  for (let i = 0; i < username.length; i++) h = (h * 31 + username.charCodeAt(i)) % COLORS.length
  return COLORS[h]
}

export default function PresenceBar({ users, currentUser }) {
  if (!users || users.length === 0) {
    return (
      <div className={styles.bar}>
        <div className={styles.label}>Online now</div>
        <div className={styles.emptyHint}>Only you — share the join code!</div>
      </div>
    )
  }

  return (
    <div className={styles.bar}>
      <div className={styles.label}>Online now · {users.length}</div>
      <div className={styles.avatars}>
        {users.map((u) => {
          const [fg, bg] = getColor(u.username)
          const isMe = u.username === currentUser
          return (
            <div key={u.username} className={styles.avatarGroup}>
              <div
                className={`${styles.avatar} ${isMe ? styles.isMe : ''}`}
                style={{ '--avatar-bg': bg, '--avatar-fg': fg }}
                title={u.username + (isMe ? ' (you)' : '')}
              >
                {u.username.slice(0, 2).toUpperCase()}
                <div className={styles.dot} />
              </div>
              <div className={`${styles.name} ${isMe ? styles.isMe : ''}`}>
                {isMe ? 'You' : u.username}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
