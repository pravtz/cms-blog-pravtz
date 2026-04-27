'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import styles from './CommentSystem.module.css'
import { fetchAdminSession } from '@/lib/fetchAdminSession'
import { getAdminApiBaseUrl } from '@/lib/adminApiBaseUrl'

interface Author {
  name: string
}

interface Comment {
  id: string
  post_id: string
  parent_id: string | null
  author_id: string
  author_name: string
  content: string
  status: string
  upvotes: number
  downvotes: number
  created_at: string
  user_vote: number | null
  replies: Comment[]
}

interface User {
  id: string
  name: string
  email: string
  role: string
}

interface CommentSystemProps {
  postId: string
  postSlug: string
}

function formatDate(iso: string) {
  try {
    return new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z').toLocaleDateString('pt-BR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

function CommentCard({
  comment,
  currentUser,
  accessToken,
  onVote,
  onReply,
  onReport,
  depth = 0,
}: {
  comment: Comment
  currentUser: User | null
  accessToken: string | null
  onVote: (commentId: string, vote: 1 | -1) => void
  onReply: (commentId: string) => void
  onReport: (commentId: string) => void
  depth?: number
}) {
  const [showReplies, setShowReplies] = useState(comment.replies.length <= 5)
  const hasReplies = comment.replies.length > 0

  return (
    <article id={`comment-${comment.id}`} className={`${styles.comment} ${depth > 0 ? styles.reply : ''}`}>
      <div className={styles.commentMeta}>
        <span className={styles.commentAuthor}>{comment.author_name}</span>
        <time className={styles.commentDate} dateTime={comment.created_at}>
          {formatDate(comment.created_at)}
        </time>
      </div>

      <p className={styles.commentContent}>{comment.content}</p>

      <div className={styles.commentActions}>
        {currentUser ? (
          <>
            <button
              className={`${styles.voteBtn} ${comment.user_vote === 1 ? styles.voted : ''}`}
              onClick={() => onVote(comment.id, 1)}
              aria-label={`Upvote (${comment.upvotes})`}
              aria-pressed={comment.user_vote === 1}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="18 15 12 9 6 15" />
              </svg>
              <span>{comment.upvotes}</span>
            </button>

            <button
              className={`${styles.voteBtn} ${comment.user_vote === -1 ? styles.voted : ''}`}
              onClick={() => onVote(comment.id, -1)}
              aria-label={`Downvote (${comment.downvotes})`}
              aria-pressed={comment.user_vote === -1}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
              <span>{comment.downvotes}</span>
            </button>

            {depth === 0 && (
              <button className={styles.actionBtn} onClick={() => onReply(comment.id)}>
                Reply
              </button>
            )}

            {currentUser.id !== comment.author_id && (
              <button className={styles.reportBtn} onClick={() => onReport(comment.id)}>
                Report
              </button>
            )}
          </>
        ) : (
          <>
            <span className={styles.voteCounts}>
              <span aria-label={`${comment.upvotes} upvotes`}>↑ {comment.upvotes}</span>
              <span aria-label={`${comment.downvotes} downvotes`}>↓ {comment.downvotes}</span>
            </span>
          </>
        )}
      </div>

      {hasReplies && depth === 0 && (
        <div className={styles.repliesSection} role="region" aria-label={`Replies to ${comment.author_name}'s comment`}>
          {!showReplies && comment.replies.length > 5 && (
            <button className={styles.showRepliesBtn} onClick={() => setShowReplies(true)}>
              Show {comment.replies.length} replies
            </button>
          )}
          {showReplies && (
            <>
              {comment.replies.length > 5 && (
                <button className={styles.showRepliesBtn} onClick={() => setShowReplies(false)}>
                  Collapse replies
                </button>
              )}
              <div className={styles.repliesList}>
                {comment.replies.map((reply) => (
                  <CommentCard
                    key={reply.id}
                    comment={reply}
                    currentUser={currentUser}
                    accessToken={accessToken}
                    onVote={onVote}
                    onReply={onReply}
                    onReport={onReport}
                    depth={1}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </article>
  )
}

export default function CommentSystem({ postId, postSlug }: CommentSystemProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const fetchSession = useCallback(async () => {
    const session = await fetchAdminSession()
    if (session) {
      setCurrentUser(session.user)
      setAccessToken(session.accessToken)
    }
  }, [])

  const fetchComments = useCallback(async (token: string | null) => {
    try {
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch(`${getAdminApiBaseUrl()}/api/blog/comments?postId=${encodeURIComponent(postId)}`, {
        headers,
      })
      if (res.ok) {
        const data = await res.json()
        setComments(data.comments)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [postId])

  useEffect(() => {
    fetchSession().then(() => {
      // fetchComments will be triggered after session is set
    })
  }, [fetchSession])

  useEffect(() => {
    fetchComments(accessToken)
  }, [fetchComments, accessToken])

  const handleVote = useCallback(async (commentId: string, vote: 1 | -1) => {
    if (!accessToken) return

    const res = await fetch(`${getAdminApiBaseUrl()}/api/blog/comments/${commentId}/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ vote }),
    })

    if (res.ok) {
      const data = await res.json()
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === commentId) {
            return { ...c, upvotes: data.upvotes, downvotes: data.downvotes, user_vote: data.userVote }
          }
          return {
            ...c,
            replies: c.replies.map((r) =>
              r.id === commentId
                ? { ...r, upvotes: data.upvotes, downvotes: data.downvotes, user_vote: data.userVote }
                : r
            ),
          }
        })
      )
    }
  }, [accessToken])

  const handleReply = useCallback((commentId: string) => {
    setReplyTo(commentId)
    setContent('')
    setTimeout(() => textareaRef.current?.focus(), 100)
  }, [])

  const handleReport = useCallback(async (commentId: string) => {
    if (!accessToken || !confirm('Report this comment as inappropriate?')) return

    const res = await fetch(`${getAdminApiBaseUrl()}/api/blog/comments/${commentId}/report`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (res.ok) {
      setComments((prev) =>
        prev
          .map((c) => ({
            ...c,
            replies: c.replies.filter((r) => r.id !== commentId),
          }))
          .filter((c) => c.id !== commentId)
      )
      setSuccess('Comment reported. Thank you for keeping the community safe.')
      setTimeout(() => setSuccess(''), 4000)
    }
  }, [accessToken])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accessToken || !content.trim()) return

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(`${getAdminApiBaseUrl()}/api/blog/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          postId,
          parentId: replyTo ?? undefined,
          content: content.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to post comment.')
      } else {
        const newComment = { ...data.comment, replies: [] }
        if (replyTo) {
          setComments((prev) =>
            prev.map((c) =>
              c.id === replyTo ? { ...c, replies: [...c.replies, newComment] } : c
            )
          )
        } else {
          setComments((prev) => [...prev, newComment])
        }
        setContent('')
        setReplyTo(null)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const replyingTo = replyTo ? comments.find((c) => c.id === replyTo) : null

  return (
    <section className={styles.section} aria-label="Comments">
      <h2 className={styles.heading}>
        Comments
        {comments.length > 0 && (
          <span className={styles.count} aria-label={`${comments.length} comments`}>
            {comments.length}
          </span>
        )}
      </h2>

      {/* Auth state */}
      {!currentUser && (
        <div className={styles.loginBanner} role="note">
          <p>
            <a
              href={`${getAdminApiBaseUrl()}/admin/login`}
              className={styles.loginLink}
            >
              Log in
            </a>{' '}
            or{' '}
            <a
              href={`${getAdminApiBaseUrl()}/admin/register`}
              className={styles.loginLink}
            >
              create an account
            </a>{' '}
            to leave a comment or vote.
          </p>
        </div>
      )}

      {/* Comment form */}
      {currentUser && (
        <form onSubmit={handleSubmit} className={styles.form} aria-label="Post a comment">
          {replyingTo && (
            <div className={styles.replyingTo}>
              <span>Replying to <strong>{replyingTo.author_name}</strong></span>
              <button
                type="button"
                className={styles.cancelReply}
                onClick={() => setReplyTo(null)}
                aria-label="Cancel reply"
              >
                ✕
              </button>
            </div>
          )}

          <label htmlFor="comment-content" className={styles.srOnly}>
            {replyingTo ? 'Write your reply' : 'Write a comment'}
          </label>
          <textarea
            id="comment-content"
            ref={textareaRef}
            className={styles.textarea}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={replyingTo ? 'Write your reply…' : 'Write a comment…'}
            rows={4}
            maxLength={2000}
            required
            aria-describedby={error ? 'comment-error' : undefined}
          />
          <div className={styles.formFooter}>
            <span className={styles.charCount} aria-live="polite">
              {content.length}/2000
            </span>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={submitting || !content.trim()}
            >
              {submitting ? 'Posting…' : replyingTo ? 'Post reply' : 'Post comment'}
            </button>
          </div>
          {error && (
            <p id="comment-error" className={styles.errorMsg} role="alert">
              {error}
            </p>
          )}
        </form>
      )}

      {success && (
        <p className={styles.successMsg} role="status" aria-live="polite">
          {success}
        </p>
      )}

      {/* Comment list */}
      {loading ? (
        <div className={styles.loading} aria-busy="true">
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
        </div>
      ) : comments.length === 0 ? (
        <p className={styles.empty}>No comments yet. Be the first to share your thoughts!</p>
      ) : (
        <div className={styles.commentList} role="list" aria-label="Comment list">
          {comments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              currentUser={currentUser}
              accessToken={accessToken}
              onVote={handleVote}
              onReply={handleReply}
              onReport={handleReport}
            />
          ))}
        </div>
      )}
    </section>
  )
}
