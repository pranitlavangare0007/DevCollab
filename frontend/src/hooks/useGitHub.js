import { useState, useCallback } from 'react'
import api from '../api/axiosInstance'

export function useGitHub() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const clear = () => setError('')

  /**
   * Start GitHub OAuth.
   * Store the user's JWT inside the OAuth state parameter.
   */
  const connectGitHub = useCallback(async () => {
    try {
      const { data } = await api.get('/github/auth-url')

      const jwt = sessionStorage.getItem('dc_token')

      if (!jwt) {
        alert('You must be logged in first.')
        return
      }

      // Replace the default state with the JWT
      const authUrl = data.url.replace(
        'state=devcollab',
        `state=${encodeURIComponent(jwt)}`
      )

      window.location.href = authUrl
    } catch (e) {
      console.error('Failed to get GitHub auth URL', e)
      setError('Unable to connect GitHub.')
    }
  }, [])

  const getStatus = useCallback(async () => {
    try {
      const { data } = await api.get('/github/status')
      return data
    } catch {
      return {
        connected: false,
        githubUsername: ''
      }
    }
  }, [])

  const disconnect = useCallback(async () => {
    await api.delete('/github/disconnect')
  }, [])

  const listRepos = useCallback(async () => {
    setLoading(true)
    clear()

    try {
      const { data } = await api.get('/github/repos')
      return data
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load repositories')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const listPRs = useCallback(async (repo) => {
    setLoading(true)
    clear()

    try {
      const [owner, repoName] = repo.split('/')

      const { data } = await api.get(
        `/github/repos/${owner}/${repoName}/pulls`
      )

      return data
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load pull requests')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const listPRFiles = useCallback(async (repo, prNumber) => {
    setLoading(true)
    clear()

    try {
      const [owner, repoName] = repo.split('/')

      const { data } = await api.get(
        `/github/repos/${owner}/${repoName}/pulls/${prNumber}/files`
      )

      return data
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load PR files')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const importPR = useCallback(async (repo, prNumber, filename = null) => {
    setLoading(true)
    clear()

    try {
      const { data } = await api.post('/github/import-pr', {
        repo,
        prNumber,
        filename
      })

      return data
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to import PR')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    error,
    connectGitHub,
    getStatus,
    disconnect,
    listRepos,
    listPRs,
    listPRFiles,
    importPR
  }
}