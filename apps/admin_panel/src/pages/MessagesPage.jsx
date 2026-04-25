import { useEffect, useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useConversationsQuery, useMessagesQuery, useSendMessageMutation } from '../services/api'
import { connectSocket, getSocket } from '../services/socket'
import { FiMessageSquare, FiSend } from 'react-icons/fi'

function formatMsgTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function conversationLabel(c) {
  if (!c || c.id == null) return 'Conversation'
  const id = String(c.id ?? '')
  const phone = c.peerPhone != null ? String(c.peerPhone) : ''
  const role = c.peerRole != null ? String(c.peerRole) : ''
  if (role === 'rider' && phone) return `Rider support · ${phone}`
  if (role === 'driver' && phone) return `Driver · ${phone}`
  if (phone) return `${role || 'User'} · ${phone}`
  if (c.peerUserId != null) return `Conversation ${id} · peer #${c.peerUserId}`
  return `Conversation ${id}`
}

export default function MessagesPage() {
  const auth = useSelector((s) => s.auth)
  const myUserId = auth.user?.id != null ? String(auth.user.id) : ''
  const [activeConversation, setActiveConversation] = useState('')
  const [content, setContent] = useState('')
  const [supportOnly, setSupportOnly] = useState(false)
  const listEndRef = useRef(null)

  const { data: conversations = [], refetch: refetchConversations } = useConversationsQuery()
  const {
    data: messages = [],
    refetch: refetchMessages,
    isFetching: messagesLoading,
  } = useMessagesQuery(activeConversation, { skip: !activeConversation })
  const [sendMessage, sendState] = useSendMessageMutation()

  const filteredConversations = useMemo(() => {
    if (!supportOnly) return conversations
    return conversations.filter((c) => String(c.peerRole) === 'rider')
  }, [conversations, supportOnly])

  useEffect(() => {
    if (!auth.accessToken) return undefined
    connectSocket(auth.accessToken)
    const s = getSocket()
    if (!s) return undefined
    const onNew = (msg) => {
      if (activeConversation && String(msg?.conversationId) === String(activeConversation)) {
        void refetchMessages()
      }
      void refetchConversations()
    }
    s.on('message:new', onNew)
    return () => {
      s.off('message:new', onNew)
    }
  }, [auth.accessToken, activeConversation, refetchMessages, refetchConversations])

  useEffect(() => {
    const s = getSocket()
    if (!s || !activeConversation) return undefined
    s.emit('conversation:join', { conversationId: activeConversation })
    return undefined
  }, [activeConversation])

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeConversation])

  const onSend = async () => {
    if (!activeConversation || !content.trim()) return
    const trimmed = content.trim()
    if (auth.accessToken) connectSocket(auth.accessToken)
    const s = getSocket()
    if (s?.connected) {
      try {
        await new Promise((resolve, reject) => {
          const t = window.setTimeout(() => reject(new Error('timeout')), 15000)
          s.emit('message:send', { conversationId: activeConversation, content: trimmed }, (ack) => {
            window.clearTimeout(t)
            if (ack && ack.ok) resolve()
            else reject(new Error(ack?.error || 'Send failed'))
          })
        })
        setContent('')
        void refetchMessages()
        void refetchConversations()
        return
      } catch {
        /* fall through to REST */
      }
    }
    await sendMessage({ conversationId: activeConversation, content: trimmed }).unwrap()
    setContent('')
    void refetchMessages()
  }

  return (
    <section className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <FiMessageSquare size={16} className="text-slate-500" aria-hidden />
            Conversations
          </h3>
          <label className="mb-3 flex cursor-pointer items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={supportOnly} onChange={(e) => setSupportOnly(e.target.checked)} />
            Rider threads only
          </label>
          <div className="max-h-[min(28rem,55vh)] space-y-1 overflow-y-auto pr-1">
            {!filteredConversations.length ? (
              <p className="text-sm text-slate-500">No conversations match.</p>
            ) : (
              filteredConversations.map((c) => {
                const id = String(c.id)
                const active = id === activeConversation
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveConversation(id)}
                    className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                      active
                        ? 'border-sky-300 bg-sky-50 text-slate-900'
                        : 'border-transparent bg-slate-50/80 text-slate-700 hover:border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="block font-medium leading-snug">{conversationLabel(c)}</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-slate-400">#{id}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="flex min-h-[min(28rem,55vh)] flex-col rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-8">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-medium text-slate-800">
              {activeConversation ? conversationLabel(conversations.find((x) => String(x.id) === activeConversation) || {}) : 'Select a conversation'}
            </p>
            {messagesLoading ? <p className="text-xs text-slate-400">Loading messages…</p> : null}
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/50 px-4 py-4">
            {!activeConversation ? (
              <p className="py-8 text-center text-sm text-slate-500">Choose a thread from the list to read and send messages.</p>
            ) : !messages.length ? (
              <p className="py-8 text-center text-sm text-slate-500">No messages yet — say hello.</p>
            ) : (
              messages.map((m) => {
                const mine = myUserId && String(m.senderUserId) === myUserId
                return (
                  <div key={String(m.id)} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 shadow-sm ${
                        mine ? 'rounded-br-md bg-slate-900 text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</p>
                      <p className={`mt-1 text-[10px] ${mine ? 'text-slate-300' : 'text-slate-400'}`}>
                        {mine ? 'You' : `User ${m.senderUserId}`} · {formatMsgTime(m.createdAt)}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={listEndRef} />
          </div>

          <div className="border-t border-slate-100 p-3">
            <div className="flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={activeConversation ? 'Type a reply…' : 'Select a conversation first'}
                disabled={!activeConversation || sendState.isLoading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void onSend()
                  }
                }}
              />
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                onClick={() => void onSend()}
                disabled={!activeConversation || !content.trim() || sendState.isLoading}
              >
                <FiSend size={16} aria-hidden />
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
