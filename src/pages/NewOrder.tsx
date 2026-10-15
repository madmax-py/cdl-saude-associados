import { ArrowLeft, Check, MapPin, Search, Trash2, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { Order, Page, Partner, PartnerCpt, PartnerKind, User } from '../api/types'
import { Alert, Empty, PageHeader, Pagination, Spinner } from '../components/ui'
import { formatCpf, formatPrice } from '../lib/format'
import { useApi, useDebounced } from '../lib/useApi'

// Três passos: beneficiário (um usuário ativo do associado) → conveniado →
// procedimentos. Vindo da Rede de atendimento, o conveniado já chega escolhido.
export default function NewOrder() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState<User | null>(null)
  const [partner, setPartner] = useState<Partner | null>((location.state as { partner?: Partner } | null)?.partner ?? null)
  const [selected, setSelected] = useState<Map<number, PartnerCpt>>(new Map())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const step = !user ? 1 : !partner ? 2 : 3

  function toggle(pc: PartnerCpt) {
    const next = new Map(selected)
    if (next.has(pc.cpt.id)) next.delete(pc.cpt.id)
    else next.set(pc.cpt.id, pc)
    setSelected(next)
  }

  async function create() {
    if (!user || !partner) return
    setError('')
    setBusy(true)
    try {
      const order = await api.post<Order>('/orders', {
        user_id: user.id,
        partner_id: partner.id,
        cpt_ids: [...selected.keys()],
      })
      navigate(`/guias/${order.id}`, { replace: true })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erro inesperado.')
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <Link to="/guias" className="btn btn-ghost btn-sm back"><ArrowLeft size={16} /> Guias</Link>
      <PageHeader title="Nova guia" subtitle="Escolha o funcionário, o conveniado e os procedimentos." />

      <ol className="steps" aria-label="Etapas">
        {['Beneficiário', 'Conveniado', 'Procedimentos'].map((label, i) => (
          <li key={label} className={step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''}>
            <span className="step-dot">{step > i + 1 ? <Check size={14} /> : i + 1}</span>
            <span className="step-label">{label}</span>
          </li>
        ))}
      </ol>

      {user && (
        <div className="picked">
          <span><span className="muted">Beneficiário:</span> <strong>{user.name}</strong></span>
          <button className="btn btn-link btn-sm" onClick={() => setUser(null)}>Trocar</button>
        </div>
      )}
      {user && partner && (
        <div className="picked">
          <span><span className="muted">Conveniado:</span> <strong>{partner.trade_name}</strong></span>
          <button className="btn btn-link btn-sm" onClick={() => {
            setPartner(null)
            setSelected(new Map())
          }}>Trocar</button>
        </div>
      )}

      {step === 1 && <UserStep onPick={setUser} />}
      {step === 2 && <PartnerStep onPick={setPartner} />}
      {step === 3 && partner && (
        <>
          <ProcedureStep partner={partner} selected={selected} onToggle={toggle} />
          <OrderSummary selected={[...selected.values()]} onRemove={toggle} />
          <Alert>{error}</Alert>
          <div className="actions">
            <button className="btn btn-primary" disabled={busy} onClick={create}>
              {busy ? 'Gerando…' : selected.size ? `Gerar guia com ${selected.size} procedimento${selected.size > 1 ? 's' : ''}` : 'Gerar guia sem procedimentos'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function UserStep({ onPick }: { onPick: (user: User) => void }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const term = useDebounced(search)
  const users = useApi(() => api.get<Page<User>>('/users', { search: term, page }), [term, page])
  // Guia só sai para usuário ativo (a API recusa os inativos).
  const active = users.data?.data.filter((u) => u.active) ?? []

  return (
    <section className="stack">
      <label className="search">
        <Search size={18} />
        <input className="input" placeholder="Nome, CPF ou e-mail do funcionário" value={search} autoFocus
               onChange={(e) => {
                 setSearch(e.target.value)
                 setPage(1)
               }}
               aria-label="Buscar beneficiário" />
      </label>
      <Alert>{users.error}</Alert>
      {users.loading && !users.data && <Spinner />}
      {users.data && active.length === 0 && (
        <Empty icon={<UserRound size={32} />} title="Nenhum usuário ativo encontrado">
          <Link to="/usuarios/novo" className="btn btn-primary">Cadastrar usuário</Link>
        </Empty>
      )}
      <ul className="choice-list">
        {active.map((u) => (
          <li key={u.id}>
            <button className="choice" onClick={() => onPick(u)}>
              <UserRound size={20} className="list-icon" />
              <div className="list-body">
                <strong>{u.name}</strong>
                <span className="muted">CPF {formatCpf(u.document_number)}</span>
              </div>
              <span className="badge badge-trancado">{u.holder ? 'Titular' : 'Dependente'}</span>
            </button>
          </li>
        ))}
      </ul>
      {users.data && <Pagination meta={users.data.meta} onChange={setPage} />}
    </section>
  )
}

function PartnerStep({ onPick }: { onPick: (partner: Partner) => void }) {
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState('')
  const [page, setPage] = useState(1)
  const term = useDebounced(search)
  const kinds = useApi(() => api.get<{ data: PartnerKind[] }>('/lookups/partner_kinds'), [])
  const partners = useApi(
    () => api.get<Page<Partner>>('/partners', { search: term, partner_kind_id: kind, page }),
    [term, kind, page],
  )

  return (
    <section className="stack">
      <div className="filters">
        <label className="search">
          <Search size={18} />
          <input className="input" placeholder="Nome do conveniado" value={search} autoFocus
                 onChange={(e) => {
                   setSearch(e.target.value)
                   setPage(1)
                 }}
                 aria-label="Buscar conveniado" />
        </label>
        <select className="input" value={kind} aria-label="Tipo de conveniado"
                onChange={(e) => {
                  setKind(e.target.value)
                  setPage(1)
                }}>
          <option value="">Todos os tipos</option>
          {kinds.data?.data.map((k) => <option key={k.id} value={k.id}>{k.description}</option>)}
        </select>
      </div>
      <Alert>{partners.error}</Alert>
      {partners.loading && !partners.data && <Spinner />}
      {partners.data?.data.length === 0 && <Empty icon={<MapPin size={32} />} title="Nenhum conveniado encontrado" />}
      <ul className="choice-list">
        {partners.data?.data.map((p) => (
          <li key={p.id}>
            <button className="choice" onClick={() => onPick(p)}>
              <MapPin size={20} className="list-icon" />
              <div className="list-body">
                <strong>{p.trade_name}</strong>
                <span className="muted">
                  {p.address.street}, {p.address.number} · {p.address.district}
                  {p.address.city && ` · ${p.address.city}/${p.address.state}`}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
      {partners.data && <Pagination meta={partners.data.meta} onChange={setPage} />}
    </section>
  )
}

function ProcedureStep({ partner, selected, onToggle }: {
  partner: Partner
  selected: Map<number, PartnerCpt>
  onToggle: (pc: PartnerCpt) => void
}) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const term = useDebounced(search)
  const cpts = useApi(
    () => api.get<Page<PartnerCpt>>(`/partners/${partner.id}/cpts`, { search: term, page }),
    [partner.id, term, page],
  )

  return (
    <section className="card stack">
      <label className="search">
        <Search size={18} />
        <input className="input" placeholder="Buscar por nome, código ou valor" value={search} autoFocus
               onChange={(e) => {
                 setSearch(e.target.value)
                 setPage(1)
               }}
               aria-label="Buscar procedimento" />
      </label>
      <Alert>{cpts.error}</Alert>
      {cpts.loading && !cpts.data && <Spinner />}
      {cpts.data?.data.length === 0 && <p className="muted">Nenhum procedimento encontrado.</p>}
      <ul className={cpts.loading ? 'list is-loading' : 'list'}>
        {cpts.data?.data.map((pc) => {
          const checked = selected.has(pc.cpt.id)
          return (
            <li key={pc.id}>
              <label className={checked ? 'list-item check-row checked' : 'list-item check-row'}>
                <input type="checkbox" checked={checked} onChange={() => onToggle(pc)} />
                <div className="list-body">
                  <strong>{pc.cpt.description}</strong>
                  <span className="muted">{pc.cpt.specialty ? 'Especialidade' : `Código ${pc.cpt.formatted_code}`}</span>
                </div>
                <span className="price">{formatPrice(pc.price, pc.pct)}</span>
              </label>
            </li>
          )
        })}
      </ul>
      {cpts.data && <Pagination meta={cpts.data.meta} onChange={setPage} />}
    </section>
  )
}

// Soma só os valores em reais; procedimentos com desconto percentual aparecem
// à parte, porque o valor final depende da tabela do conveniado.
function OrderSummary({ selected, onRemove }: { selected: PartnerCpt[]; onRemove: (pc: PartnerCpt) => void }) {
  if (selected.length === 0) return null
  const total = selected.filter((pc) => !pc.pct).reduce((sum, pc) => sum + pc.price, 0)
  const withDiscount = selected.filter((pc) => pc.pct).length

  return (
    <section className="card">
      <div className="section-head">
        <h2>Selecionados ({selected.length})</h2>
        <strong className="price">{formatPrice(total, false)}</strong>
      </div>
      {withDiscount > 0 && (
        <p className="muted">
          O total não inclui {withDiscount === 1 ? 'o procedimento' : `os ${withDiscount} procedimentos`} com desconto
          percentual, cujo valor final depende da tabela do conveniado.
        </p>
      )}
      <ul className="list">
        {selected.map((pc) => (
          <li key={pc.cpt.id} className="list-item list-item-compact">
            <div className="list-body"><strong>{pc.cpt.description}</strong></div>
            <span className="price">{formatPrice(pc.price, pc.pct)}</span>
            <button className="btn btn-ghost btn-icon danger" onClick={() => onRemove(pc)}
                    aria-label={`Remover ${pc.cpt.description}`}>
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
