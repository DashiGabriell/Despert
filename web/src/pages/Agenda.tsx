import { useState } from 'react'
import CalendarioMes from '../components/CalendarioMes'
import FiltroResponsavel from '../components/FiltroResponsavel'
import { alertaErro } from '../components/ui'
import { usePlano } from '../data/plano'
import { useFeriados, usePrazos } from '../data/queries'
import { useFiltroResponsavel } from '../data/responsaveis'
import { mesDe } from '../domain/datas'
import { filtrarPorResponsavel } from '../domain/filtros'
import { useUserId } from '../lib/auth-context'
import { useLayout } from '../lib/layout-context'
import { useOrganizacaoId, usePode } from '../lib/organizacao-context'
import { mensagemDeErro } from '../lib/toast-context'

export default function Agenda() {
  const orgId = useOrganizacaoId()
  const eu = useUserId()
  const { hoje, abrirPrazo, novoPrazo } = useLayout()
  const prazos = usePrazos(orgId)
  const feriados = useFeriados(orgId)
  const filtroResponsavel = useFiltroResponsavel(orgId, eu)
  const permite = usePode()
  const { escrita } = usePlano()
  const podeCriar = escrita && permite('editar_prazo')
  const [mes, setMes] = useState(() => mesDe(hoje))

  return (
    <>
      {prazos.isError && (
        <div className={`${alertaErro} mb-4`}>
          Não foi possível carregar os prazos: {mensagemDeErro(prazos.error)}
        </div>
      )}
      {filtroResponsavel.equipe && (
        <div className="mb-3 flex justify-end">
          <FiltroResponsavel filtro={filtroResponsavel} eu={eu} />
        </div>
      )}
      <CalendarioMes
        mes={mes}
        hoje={hoje}
        prazos={filtrarPorResponsavel(prazos.data ?? [], filtroResponsavel.responsavel)}
        feriados={feriados.data ?? []}
        onMudarMes={setMes}
        onAbrirPrazo={abrirPrazo}
        onCriarNoDia={(data) => novoPrazo(data)}
      />
      <p className="mt-3 text-xs text-muted">
        {podeCriar
          ? 'Clique num prazo para abrir o detalhe, ou num dia vazio para criar um prazo manual naquela data.'
          : 'Clique num prazo para abrir o detalhe.'}{' '}
        Cumpridos aparecem riscados; arquivados ficam fora da agenda.
      </p>
    </>
  )
}
