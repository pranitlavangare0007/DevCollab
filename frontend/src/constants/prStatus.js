import { GitPullRequest, GitMerge } from 'lucide-react'

export const PR_STATUS = {
  open:   { color: '#3fb950', bg: '#0d2a10', label: 'Open',   Icon: GitPullRequest },
  closed: { color: '#f85149', bg: '#1f1010', label: 'Closed', Icon: GitPullRequest },
  merged: { color: '#bc8cff', bg: '#1a0d2e', label: 'Merged', Icon: GitMerge },
}
