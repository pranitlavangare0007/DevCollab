import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axiosInstance'
import styles from './AuthPage.module.css'

const FIELDS = [
  ['username', 'Username', 'text', 'Choose a username'],
  ['email', 'Email', 'email', 'you@example.com'],
  ['password', 'Password', 'password', 'At least 6 characters'],
]

export default function RegisterPage() {
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/register', form)
      sessionStorage.setItem('dc_token', data.token)
      sessionStorage.setItem('dc_user', JSON.stringify({ id: data.id, username: data.username, email: data.email }))
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>DC</div>
          <span className={styles.logoText}>DevCollab</span>
        </div>
        <div className={styles.title}>Create your account</div>
        <div className={styles.subtitle}>Start reviewing code collaboratively</div>

        {error && <div className="alert-error">{error}</div>}

        <form onSubmit={submit}>
          {FIELDS.map(([k, label, type, ph]) => (
            <div key={k} className={styles.formGroup}>
              <label className={styles.label}>{label}</label>
              <input
                className="form-input"
                type={type}
                value={form[k]}
                onChange={set(k)}
                placeholder={ph}
                required
              />
            </div>
          ))}
          <button className={`btn btn-primary ${styles.submitBtn}`} disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <div className={styles.footer}>
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  )
}
