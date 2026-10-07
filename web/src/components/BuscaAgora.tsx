import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlano } from '../data/plano'
import { useBuscasAgora, useCancelarBuscaAgora, useExecucoes, useRegistrarBuscaAgora } from '../data/queries'
import { useAgora } from '../data/relogio'
import {
  estadoDaBusca,
  execucaoDoDisparo,
  LIMITE_ESPERA_MS,
  pendenciaBusca,
  restanteCooldown,
  urlDisparo,
} from '../domain/busca'
import { buscasAgoraRestantes, resumoBuscasAgora } from '../domain/planos'
import type { Monitoramento } from '../lib/database.types'
import { mensagemDeErro, useToast } from '../lib/toast-context'
import BotaoBuscarAgora from './BotaoBuscarAgora'

interface Props {
  orgId: string
  /** Token do Buscar agora da organização: o robô busca para todos os advogados dela. */
  token: string | undefined
  /** URL do webhook da configuração do sistema (definida pelo dev). */
  webhookUrl: string | undefined
  monitoramentos: readonly Monitoramento[]
}

/**
 * Dispara o robô pela Production URL do webhook (ADR-0004). Antes, o banco registra o disparo
 * e confere o intervalo mínimo e a cota diária da organização (ADR-0008). A resposta do fetch
 * não é lida: o resultado chega pela tabela de execuções, acompanhada em tempo real.
 */
export default function BuscaAgora({ orgId, token, webhookUrl, monitoramentos }: Props) {
  const avisar = useToast()
  const navigate = useNavigate()
  const { limites, escrita } = usePlano()
  const buscas = useBuscasAgora(orgId)
  const registrar = useRegistrarBuscaAgora(orgId)
  const cancelar = useCancelarBuscaAgora(orgId)
  const [disparadoEm, setDisparadoEm] = useState<number | null>(null)

  const agora = useAgora(1000, (buscas.data?.length ?? 0) > 0 || disparadoEm !== null)
  const resumo = resumoBuscasAgora(buscas.data ?? [], agora)
  const restantesHoje = buscasAgoraRestantes(limites, resumo.hoje)
  const acompanhando = disparadoEm !== null && agora - disparadoEm < LIMITE_ESPERA_MS
  const { data: execucoes = [] } = useExecucoes(orgId, { acompanhar: acompanhando })

  const execucao = disparadoEm === null ? null : execucaoDoDisparo(execucoes, disparadoEm)
  const restanteMs = restanteCooldown(resumo.ultima, agora, limites.intervalo_busca_min * 60_000)
  const estado = estadoDaBusca({
    disparadoEm,
    respondida: execucao !== null,
    restanteMs,
    agora,
    esgotado: restantesHoje === 0,
    indisponivel: !escrita,
  })

  const avisadoPara = useRef<number | null>(null)
  useEffect(() => {
    if (disparadoEm === null || avisadoPara.current === disparadoEm) return
    if (execucao) {
      avisadoPara.current = disparadoEm
      if (execucao.status === 'ok') {
        avisar(
          `Busca concluída: ${execucao.encontradas} publicação(ões) encontrada(s), ${execucao.novas} nova(s).`,
          'ok',
        )
      } else {
        avisar('A busca falhou. Veja o detalhe no Histórico.', 'erro')
      }
    } else if (!acompanhando) {
      avisadoPara.current = disparadoEm
      avisar(
        'O robô não registrou a execução em 3 minutos. Se continuar, avise o administrador do sistema.',
        'erro',
      )
    }
  }, [disparadoEm, execucao, acompanhando, avisar])

  async function buscar() {
    const pendencia = pendenciaBusca(webhookUrl, monitoramentos)
    if (pendencia === 'webhook' || !webhookUrl) {
      avisar('O robô ainda não foi ativado pelo administrador do sistema. Tente mais tarde.', 'erro')
      return
    }
    if (!token) {
      avisar('As configurações da organização ainda estão carregando. Tente de novo em instantes.', 'erro')
      return
    }
    if (pendencia === 'monitoramento') {
      navigate('/monitoramento')
      avisar('Cadastre ao menos uma OAB ou processo ativo antes de buscar.', 'erro')
      return
    }

    let registro: number
    try {
      registro = await registrar.mutateAsync()
    } catch (falha) {
      avisar(mensagemDeErro(falha), 'erro')
      return
    }
    setDisparadoEm(Date.now())

    const desfazer = (mensagem: string) => {
      setDisparadoEm(null)
      cancelar.mutate(registro)
      avisar(mensagem, 'erro')
    }

    const url = urlDisparo(webhookUrl, token)
    try {
      const resposta = await fetch(url, { method: 'GET' })
      if (!resposta.ok) {
        desfazer(`O robô recusou o disparo (HTTP ${resposta.status}). Avise o administrador do sistema.`)
        return
      }
    } catch {
      // Navegador bloqueou a leitura (CORS): dispara sem ler a resposta.
      try {
        await fetch(url, { method: 'GET', mode: 'no-cors' })
      } catch {
        desfazer('Não foi possível acessar o robô. Avise o administrador do sistema.')
        return
      }
    }
    avisar('Busca iniciada no Diário. Costuma levar menos de um minuto.')
  }

  return (
    <BotaoBuscarAgora
      estado={registrar.isPending ? 'buscando' : estado}
      restanteMs={restanteMs}
      intervaloMin={limites.intervalo_busca_min}
      restantesHoje={restantesHoje}
      onBuscar={() => void buscar()}
    />
  )
}
