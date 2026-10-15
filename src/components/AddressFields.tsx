import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { City, Page, State } from '../api/types'
import { formatCep } from '../lib/format'
import { useApi, useDebounced } from '../lib/useApi'
import { Field } from './ui'

export interface AddressValue {
  postal_code: string
  address_street: string
  address_number: string
  address_complement: string
  address_district: string
  city_id: number | null
}

interface Props {
  value: AddressValue
  onChange: (value: AddressValue) => void
  errors: Record<string, string[]>
  // Para pré-selecionar estado e cidade de um cadastro existente.
  initialStateAcronym?: string | null
  initialCityName?: string | null
}

export default function AddressFields({ value, onChange, errors, initialStateAcronym, initialCityName }: Props) {
  const states = useApi(() => api.get<{ data: State[] }>('/lookups/states'), [])
  const [stateId, setStateId] = useState('')
  const [cityQuery, setCityQuery] = useState(initialCityName ?? '')
  const query = useDebounced(cityQuery)

  useEffect(() => {
    if (stateId || !initialStateAcronym || !states.data) return
    const match = states.data.data.find((s) => s.acronym === initialStateAcronym)
    if (match) setStateId(String(match.id))
  }, [states.data, initialStateAcronym, stateId])

  // A lista de cidades é paginada na API: a busca por nome restringe o resultado.
  const cities = useApi(
    () => (stateId ? api.get<Page<City>>('/lookups/cities', { state_id: stateId, search: query }) : Promise.resolve(null)),
    [stateId, query],
  )

  const set = (patch: Partial<AddressValue>) => onChange({ ...value, ...patch })

  return (
    <div className="form-grid">
      <Field label="CEP" error={errors.postal_code}>
        <input className="input" inputMode="numeric" value={formatCep(value.postal_code)}
               onChange={(e) => set({ postal_code: e.target.value.replace(/\D/g, '') })} required />
      </Field>
      <Field label="Rua" error={errors.address_street}>
        <input className="input" value={value.address_street} onChange={(e) => set({ address_street: e.target.value })} required />
      </Field>
      <Field label="Número" error={errors.address_number}>
        <input className="input" value={value.address_number} onChange={(e) => set({ address_number: e.target.value })} required />
      </Field>
      <Field label="Complemento" error={errors.address_complement}>
        <input className="input" value={value.address_complement}
               onChange={(e) => set({ address_complement: e.target.value })} />
      </Field>
      <Field label="Bairro" error={errors.address_district}>
        <input className="input" value={value.address_district} onChange={(e) => set({ address_district: e.target.value })} required />
      </Field>
      <Field label="Estado">
        <select className="input" value={stateId} onChange={(e) => {
          setStateId(e.target.value)
          setCityQuery('')
          set({ city_id: null })
        }} required>
          <option value="" disabled>Selecione…</option>
          {states.data?.data.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field label="Cidade" error={errors.city || errors.city_id} hint={stateId ? 'Digite para buscar' : 'Escolha o estado primeiro'}>
        <input className="input" list="city-options" disabled={!stateId} value={cityQuery}
               onChange={(e) => {
                 const name = e.target.value
                 setCityQuery(name)
                 const match = cities.data?.data.find((c) => c.name.toLowerCase() === name.toLowerCase())
                 set({ city_id: match?.id ?? null })
               }}
               onBlur={() => {
                 const match = cities.data?.data.find((c) => c.name.toLowerCase() === cityQuery.toLowerCase())
                 if (match) set({ city_id: match.id })
               }}
               required />
        <datalist id="city-options">
          {cities.data?.data.map((c) => <option key={c.id} value={c.name} />)}
        </datalist>
      </Field>
    </div>
  )
}
