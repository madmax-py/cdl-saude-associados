import { ChevronDown, ChevronUp, FilePlus2, MapPin, Phone, Search } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Page, Partner, PartnerCpt, PartnerKind } from '../api/types'
import { Alert, Empty, PageHeader, Pagination, Spinner } from '../components/ui'
import { formatPhone, formatPrice } from '../lib/format'
import { useApi, useDebounced } from '../lib/useApi'

export default function ServiceNetwork() {
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState('')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<number | null>(null)
  const term = useDebounced(search)

  const kinds = useApi(() => api.get<{ data: PartnerKind[] }>('/lookups/partner_kinds'), [])
  const partners = useApi(
    () => api.get<Page<Partner>>('/partners', { search: term, partner_kind_id: kind, page }),
    [term, kind, page],
  )

  return (
    <div className="stack">
      <PageHeader title="Rede de atendimento" subtitle="Conveniados onde seus funcionários podem usar o CDL Saúde." />

      <div className="filters">
        <label className="search">
          <Search size={18} />
          <input
            className="input"
            placeholder="Nome do conveniado"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            aria-label="Buscar conveniado"
          />
        </label>
        <select
          className="input"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value)
            setPage(1)
          }}
          aria-label="Tipo de conveniado"
        >
          <option value="">Todos os tipos</option>
          {kinds.data?.data.map((k) => <option key={k.id} value={k.id}>{k.description}</option>)}
        </select>
      </div>

      <Alert>{partners.error}</Alert>
      {partners.loading && !partners.data && <Spinner />}
      {partners.data?.data.length === 0 && <Empty icon={<MapPin size={32} />} title="Nenhum conveniado encontrado" />}

      <ul className="stack">
        {partners.data?.data.map((partner) => (
          <li key={partner.id} className="card partner">
            <button
              className="partner-head"
              onClick={() => setOpenId(openId === partner.id ? null : partner.id)}
              aria-expanded={openId === partner.id}
            >
              <div className="list-body">
                <strong>{partner.trade_name}</strong>
                <span className="muted">
                  <MapPin size={14} /> {partner.address.street}, {partner.address.number} · {partner.address.district}
                  {partner.address.city && ` · ${partner.address.city}/${partner.address.state}`}
                </span>
                {partner.phone && (
                  <span className="muted"><Phone size={14} /> {formatPhone(partner.phone)}</span>
                )}
              </div>
              {openId === partner.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            {openId === partner.id && <PartnerCpts partner={partner} />}
          </li>
        ))}
      </ul>
      {partners.data && <Pagination meta={partners.data.meta} onChange={setPage} />}
    </div>
  )
}

function PartnerCpts({ partner }: { partner: Partner }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const term = useDebounced(search)
  const cpts = useApi(
    () => api.get<Page<PartnerCpt>>(`/partners/${partner.id}/cpts`, { search: term, page }),
    [partner.id, term, page],
  )

  return (
    <div className="partner-cpts">
      <button className="btn btn-primary btn-sm partner-order" onClick={() => navigate('/guias/nova', { state: { partner } })}>
        <FilePlus2 size={16} /> Gerar guia neste conveniado
      </button>
      <label className="search">
        <Search size={16} />
        <input
          className="input input-sm"
          placeholder="Filtrar procedimentos"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          aria-label="Filtrar procedimentos do conveniado"
        />
      </label>
      {cpts.loading && !cpts.data && <Spinner />}
      <Alert>{cpts.error}</Alert>
      {cpts.data?.data.length === 0 && <p className="muted">Nenhum procedimento encontrado.</p>}
      <ul className="list">
        {cpts.data?.data.map((pc) => (
          <li key={pc.id} className="list-item">
            <div className="list-body">
              <strong>{pc.cpt.description}</strong>
              <span className="muted">{pc.cpt.specialty ? 'Consulta / especialidade' : `Código ${pc.cpt.formatted_code}`}</span>
            </div>
            <span className="price">{formatPrice(pc.price, pc.pct)}</span>
          </li>
        ))}
      </ul>
      {cpts.data && <Pagination meta={cpts.data.meta} onChange={setPage} />}
    </div>
  )
}
