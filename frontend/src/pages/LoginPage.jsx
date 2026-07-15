import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axiosInstance'
import styles from './AuthPage.module.css'

export default function LoginPage() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', form)
      sessionStorage.setItem('dc_token', data.token)
      sessionStorage.setItem('dc_user', JSON.stringify({ id: data.id, username: data.username, email: data.email }))
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid username or password')
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
        <div className={styles.title}>Welcome back</div>
        <div className={styles.subtitle}>Sign in to your account to continue</div>

        {error && <div className="alert-error">{error}</div>}

        <form onSubmit={submit}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Username</label>
            <input
              className="form-input"
              value={form.username}
              onChange={set('username')}
              placeholder="your username"
              required
              autoFocus
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Password</label>
            <input
              className="form-input"
              type="password"
              value={form.password}
              onChange={set('password')}
              placeholder="••••••••"
              required
            />
          </div>
          <button className={`btn btn-primary ${styles.submitBtn}`} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className={styles.footer}>
          Don't have an account? <Link to="/register">Create one</Link>
        </div>
      </div>
    </div>
  )
}
