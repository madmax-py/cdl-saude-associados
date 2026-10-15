import { AlertTriangle, CalendarDays, Clock, FilePlus2, FileText, Hospital, UserPlus, UserX, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { AssociateDashboard, Order } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Alert, Spinner, StatusBadge } from '../components/ui'
import { formatCpf, formatDate } from '../lib/format'
import { useApi } from '../lib/useApi'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

// A API só devolve os meses que tiveram guia ("MM/AAAA"); o gráfico mostra
// sempre os últimos 6, com zero onde não houve nenhuma.
function lastSixMonths(byMonth: Record<string, number>) {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    const key = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
    return { key, label: MONTHS[date.getMonth()], count: byMonth[key] ?? 0 }
  })
}

export default function Home() {
  const { me } = useAuth()
  const dashboard = useApi(() => api.get<AssociateDashboard>('/dashboard'), [])

  if (dashboard.loading) return <Spinner />
  if (dashboard.error || !dashboard.data) return <Alert>{dashboard.error}</Alert>

  const d = dashboard.data
  const months = lastSixMonths(d.orders_by_month)
  const attention = d.incomplete_orders.length + d.stale_orders.length + d.inactive_users.length

  return (
    <div className="dash">
      <section className="hero card dash-hero">
        <div>
          <p className="hero-eyebrow">Painel do associado</p>
          <h1>{me?.associate.trade_name}</h1>
          <p>Gere guias para seus funcionários e acompanhe como eles usam o CDL Saúde.</p>
        </div>
        <div className="hero-actions">
          <Link to="/guias/nova" className="btn btn-light"><FilePlus2 size={18} /> Gerar guia</Link>
          <Link to="/usuarios/novo" className="btn btn-outline-light"><UserPlus size={18} /> Cadastrar usuário</Link>
        </div>
      </section>

      <div className="dash-stats">
        <Stat icon={<CalendarDays size={20} />} value={d.orders_this_month} label="guias neste mês" />
        <Stat icon={<FileText size={20} />} value={d.total_orders} label="guias no total" />
        <Stat icon={<Users size={20} />} value={d.active_users} label={`usuários ativos de ${d.total_users}`} />
        <Stat icon={<Hospital size={20} />} value={d.active_partners} label="conveniados na rede" />
      </div>

      <section className="card dash-chart">
        <h2>Guias por mês</h2>
        <p className="muted">Últimos 6 meses</p>
        <MonthlyBars months={months} />
      </section>

      <section className="card dash-top">
        <h2>Procedimentos mais usados</h2>
        <p className="muted">Em todas as guias do associado</p>
        {d.top_cpts.length === 0 ? (
          <p className="muted dash-empty">Ainda não há procedimentos em guias.</p>
        ) : (
          <TopList items={d.top_cpts} />
        )}
      </section>

      <section className="card dash-recent">
        <div className="section-head">
          <h2>Últimas guias</h2>
          <Link to="/guias" className="btn btn-link btn-sm">Ver todas</Link>
        </div>
        {d.recent_orders.length === 0 && <p className="muted">Nenhuma guia emitida ainda.</p>}
        <OrderList orders={d.recent_orders.slice(0, 6)} />
      </section>

      <section className="card dash-attention">
        <div className="section-head">
          <h2>Precisa de atenção</h2>
          {attention > 0 && <span className="badge badge-pendente">{attention}</span>}
        </div>
        {attention === 0 && <p className="muted">Tudo em dia por aqui.</p>}

        {d.incomplete_orders.length > 0 && (
          <AttentionGroup icon={<AlertTriangle size={16} />} title="Guias sem procedimentos há mais de 1 dia">
            <OrderList orders={d.incomplete_orders} compact />
          </AttentionGroup>
        )}
        {d.stale_orders.length > 0 && (
          <AttentionGroup icon={<Clock size={16} />} title="Guias pendentes há mais de 7 dias">
            <OrderList orders={d.stale_orders} compact />
          </AttentionGroup>
        )}
        {d.inactive_users.length > 0 && (
          <AttentionGroup icon={<UserX size={16} />} title="Usuários desativados recentemente">
            <ul className="list">
              {d.inactive_users.map((u) => (
                <li key={u.id}>
                  <Link to={`/usuarios/${u.id}`} className="list-item list-item-compact">
                    <div className="list-body">
                      <strong>{u.name}</strong>
                      <span className="muted">CPF {formatCpf(u.document_number)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </AttentionGroup>
        )}
      </section>
    </div>
  )
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="stat card">
      <span className="stat-icon">{icon}</span>
      <div>
        <span className="stat-value">{value}</span>
        <span className="stat-label">{label}</span>
      </div>
    </div>
  )
}

// Barras verticais de uma série só: uma cor, valor do mês atual sempre visível
// e dos demais ao passar o mouse, e uma tabela equivalente para leitores de tela.
function MonthlyBars({ months }: { months: { key: string; label: string; count: number }[] }) {
  const max = Math.max(1, ...months.map((m) => m.count))
  const current = months[months.length - 1]

  return (
    <>
      <div className="bars" aria-hidden="true">
        {months.map((m) => (
          <div key={m.key} className={m.key === current.key ? 'bar-col current' : 'bar-col'} title={`${m.key}: ${m.count} guia${m.count === 1 ? '' : 's'}`}>
            <div className="bar-track">
              <span className="bar-value">{m.count}</span>
              <div className="bar" style={{ height: `${(m.count / max) * 100}%` }} />
            </div>
            <span className="bar-label">{m.label}</span>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>Guias por mês</caption>
        <tbody>
          {months.map((m) => (
            <tr key={m.key}><th>{m.key}</th><td>{m.count}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function TopList({ items }: { items: { description: string; count: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.count))
  return (
    <ol className="top-list">
      {items.map((item) => (
        <li key={item.description}>
          <div className="top-row">
            <span className="top-name">{item.description}</span>
            <span className="top-count">{item.count}</span>
          </div>
          <div className="top-track" aria-hidden="true">
            <div className="top-bar" style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  )
}

function OrderList({ orders, compact = false }: { orders: Order[]; compact?: boolean }) {
  return (
    <ul className="list">
      {orders.map((order) => (
        <li key={order.id}>
          <Link to={`/guias/${order.id}`} className={compact ? 'list-item list-item-compact' : 'list-item'}>
            {!compact && <span className="list-avatar"><FileText size={18} /></span>}
            <div className="list-body">
              <strong>{order.user?.name}</strong>
              <span className="muted">Guia #{order.id} · {order.partner?.trade_name} · {formatDate(order.created_at)}</span>
            </div>
            {!compact && <StatusBadge status={order.status} />}
          </Link>
        </li>
      ))}
    </ul>
  )
}

function AttentionGroup({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="attention-group">
      <p className="attention-title">{icon} {title}</p>
      {children}
    </div>
  )
}
