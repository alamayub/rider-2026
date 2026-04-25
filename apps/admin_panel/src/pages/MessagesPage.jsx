import { useMemo, useState } from 'react'
import { useConversationsQuery, useMessagesQuery, useSendMessageMutation } from '../services/api'
import { FiMessageSquare, FiSend } from 'react-icons/fi'

function MessagesPage() {
  const [activeConversation, setActiveConversation] = useState('')
  const [content, setContent] = useState('')
  const { data: conversations = [] } = useConversationsQuery()
  const { data: messages = [] } = useMessagesQuery(activeConversation, { skip: !activeConversation })
  const [sendMessage, sendState] = useSendMessageMutation()

  const options = useMemo(
    () => conversations.map((c) => ({ id: String(c.id), label: `${c.id} (${c.participantAId} ↔ ${c.participantBId})` })),
    [conversations],
  )

  const onSend = async () => {
    if (!activeConversation || !content.trim()) return
    await sendMessage({ conversationId: activeConversation, content: content.trim() }).unwrap()
    setContent('')
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="flex items-center gap-2 font-semibold text-slate-900">
        <FiMessageSquare size={16} />
        Messages
      </h3>
      <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={activeConversation} onChange={(e) => setActiveConversation(e.target.value)}>
        <option value="">Select conversation</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <pre className="max-h-64 overflow-auto rounded bg-slate-100 p-3 text-xs text-slate-700">{JSON.stringify(messages, null, 2)}</pre>
      <div className="flex gap-2">
        <input
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type a message"
        />
        <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60" onClick={onSend} disabled={sendState.isLoading}>
          <span className="flex items-center gap-2">
            <FiSend size={14} />
            Send
          </span>
        </button>
      </div>
    </section>
  )
}

export default MessagesPage
