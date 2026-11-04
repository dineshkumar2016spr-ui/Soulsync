// SOULSYNC left panel: selected conversations with filters and sync status
import { useMemo } from 'react'
import type { Chat } from '../lib/types'
import { timeShort } from '../lib/api'
import { Avatar, Icon } from './ui'

export type ListFilter = 'all' | 'active' | 'attention' | 'favorites'

export function ConversationList({
  chats, selectedId, onSelect, favorites, onToggleFavorite, search, onSearch,
  filter, onFilter, onAdd, onOpenPrivacy, unreadIds, syncing,
}: {
  chats: Chat[]
  selectedId: string
  onSelect: (id: string) => void
  favorites: Set<string>
  onToggleFavorite: (id: string) => void
  search: string
  onSearch: (v: string) => void
  filter: ListFilter
  onFilter: (f: ListFilter) => void
  onAdd: () => void
  onOpenPrivacy: () => void
  unreadIds: Set<string>
  syncing: boolean
}) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return chats.filter((c) => {
      const matchQ = `${c.name} ${c.lastMessage}`.toLowerCase().includes(q)
      const matchF =
        filter === 'all' ||
        (filter === 'favorites' && favorites.has(c.id)) ||
        (filter === 'attention' && unreadIds.has(c.id) || needsAttention(c)) ||
        (filter === 'active' && c.lastTs > 0)
      return matchQ && matchF
    })
  }, [chats, search, filter, favorites, unreadIds])

  return (
    <aside className="panel-left">
      <header className="left-head">
        <span className="logo-row"><span className="logo-mini" /><span className="wordmark small">S<span>OUL</span>SYNC</span></span>
        <div className="left-actions">
          <button className="icon-btn" onClick={onOpenPrivacy} title="Privacy Center" aria-label="Privacy Center"><Icon name="shield" /></button>
          <button className="icon-btn" onClick={onAdd} title="Add Conversation" aria-label="Add Conversation"><Icon name="plus" /></button>
        </div>
      </header>

      <div className="left-search">
        <label className="searchbox">
          <Icon name="search" size={15} />
          <input placeholder="Search conversations…" value={search} onChange={(e) => onSearch(e.target.value)} />
        </label>
      </div>

      <nav className="left-filters" aria-label="Conversation filters">
        {([['all', 'All'], ['active', 'Active'], ['attention', 'Needs Attention'], ['favorites', 'Favorites']] as const).map(([key, label]) => (
          <button key={key} className={`filter-chip ${filter === key ? 'active' : ''}`} onClick={() => onFilter(key)}>{label}</button>
        ))}
      </nav>

      <button className="add-conv" onClick={onAdd}><Icon name="plus" size={16} /> Add Conversation</button>

      <div className="conv-list" role="list">
        {filtered.length === 0 ? (
          <p className="conv-none">No conversations match. Connect one with “Add Conversation”.</p>
        ) : (
          filtered.map((c, i) => (
            <button
              key={c.id}
              role="listitem"
              className={`conv-row ${c.id === selectedId ? 'active' : ''}`}
              onClick={() => onSelect(c.id)}
            >
              <Avatar name={c.name} seed={i} size={42} />
              <span className="conv-main">
                <span className="conv-top">
                  <strong>{c.name}</strong>
                  <time>{c.lastTs ? timeShort(c.lastTs) : ''}</time>
                </span>
                <span className="conv-snip">{c.lastMessage || 'Waiting for messages…'}</span>
                <span className="conv-meta">
                  {(favorites.has(c.id)) && <Icon name="heart" size={12} className="fav" />}
                  {needsAttention(c) && <span className="tag attention">Needs attention</span>}
                  <span className={`tag sync ${syncing ? 'warn' : 'ok'}`}>{syncing ? 'Syncing' : 'Synced'}</span>
                </span>
              </span>
              {unreadIds.has(c.id) && <span className="unread-badge">{c.unread || 1}</span>}
              <span
                className="fav-toggle"
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(c.id) }}
                role="button"
                aria-label="Toggle favorite"
              >
                <Icon name="heart" size={13} className={favorites.has(c.id) ? 'fav' : ''} />
              </span>
            </button>
          ))
        )}
      </div>
    </aside>
  )
}

function needsAttention(c: Chat): boolean {
  // A gentle, honest heuristic: an unanswered last message (incoming) after 6h is worth attention
  if (!c.lastMessage || !c.lastTs) return false
  if (c.unread > 0) return true
  if (/^(\?|.*\?)/.test(c.lastMessage) && Date.now() - c.lastTs > 6 * 3600_000) return true
  return false
}
