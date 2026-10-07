import { useState } from 'react'
import CalendarioMes from '../components/CalendarioMes'
import { alertaErro } from '../components/ui'
import { useFeriados, usePrazos } from '../data/queries'
import { mesDe } from '../domain/datas'
import { useLayout } from '../lib/layout-context'
import { useOrganizacaoId } from '../lib/organizacao-context'
import { mensagemDeErro } from '../lib/toast-context'

export default function Agenda() {
  const orgId = useOrganizacaoId()
  const { hoje, abrirPrazo, novoPrazo } = useLayout()
  const prazos = usePrazos(orgId)
  const feriados = useFeriados(orgId)
  const [mes, setMes] = useState(() => mesDe(hoje))

  return (
    <>
      {prazos.isError && (
        <div className={`${alertaErro} mb-4`}>
          Não foi possível carregar os prazos: {mensagemDeErro(prazos.error)}
        </div>
      )}
      <CalendarioMes
        mes={mes}
        hoje={hoje}
        prazos={prazos.data ?? []}
        feriados={feriados.data ?? []}
        onMudarMes={setMes}
        onAbrirPrazo={abrirPrazo}
        onCriarNoDia={(data) => novoPrazo(data)}
      />
      <p className="mt-3 text-xs text-muted">
        Clique num prazo para abrir o detalhe, ou num dia vazio para criar um prazo manual naquela data.
        Cumpridos aparecem riscados; arquivados ficam fora da agenda.
      </p>
    </>
  )
}
