import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExecucoes, useSalvarConfiguracao } from '../data/queries'
import { useAgora } from '../data/relogio'
import {
  estadoDaBusca,
  execucaoDoDisparo,
  LIMITE_ESPERA_MS,
  pendenciaBusca,
  restanteCooldown,
  urlDisparo,
} from '../domain/busca'
import type { Configuracao, Monitoramento } from '../lib/database.types'
import { useToast } from '../lib/toast-context'
import BotaoBuscarAgora from './BotaoBuscarAgora'

interface Props {
  userId: string
  config: Configuracao | undefined
  /** URL do webhook da configuração do sistema (definida pelo dev). */
  webhookUrl: string | undefined
  monitoramentos: readonly Monitoramento[]
}

function maisRecente(a: string | null | undefined, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return Date.parse(a) >= Date.parse(b) ? a : b
}

/**
 * Dispara o robô pela Production URL do webhook (ADR-0004). A resposta do fetch não é lida:
 * o resultado chega pela tabela de execuções, que a aplicação acompanha em tempo real.
 */
export default function BuscaAgora({ userId, config, webhookUrl, monitoramentos }: Props) {
  const avisar = useToast()
  const navigate = useNavigate()
  const salvarConfig = useSalvarConfiguracao(userId)
  const [disparadoEm, setDisparadoEm] = useState<number | null>(null)
  const [ultimaLocal, setUltimaLocal] = useState<string | null>(null)
  const ultima = maisRecente(config?.ultima_busca_em, ultimaLocal)
  const agora = useAgora(1000, ultima !== null || disparadoEm !== null)
  const acompanhando = disparadoEm !== null && agora - disparadoEm < LIMITE_ESPERA_MS
  const { data: execucoes = [] } = useExecucoes(userId, { acompanhar: acompanhando })

  const execucao = disparadoEm === null ? null : execucaoDoDisparo(execucoes, disparadoEm)
  const restanteMs = restanteCooldown(ultima, agora)
  const estado = estadoDaBusca({ disparadoEm, respondida: execucao !== null, restanteMs, agora })

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
    if (!config) {
      avisar('Suas configurações ainda estão carregando. Tente de novo em instantes.', 'erro')
      return
    }
    if (pendencia === 'monitoramento') {
      navigate('/monitoramento')
      avisar('Cadastre ao menos uma OAB ou processo ativo antes de buscar.', 'erro')
      return
    }

    const anterior = config.ultima_busca_em
    const instante = Date.now()
    const iso = new Date(instante).toISOString()
    setDisparadoEm(instante)
    setUltimaLocal(iso)
    salvarConfig.mutate({ ultima_busca_em: iso })

    const desfazer = (mensagem: string) => {
      setDisparadoEm(null)
      setUltimaLocal(null)
      salvarConfig.mutate({ ultima_busca_em: anterior })
      avisar(mensagem, 'erro')
    }

    const url = urlDisparo(webhookUrl, config.webhook_token)
    try {
      const resposta = await fetch(url, { method: 'GET' })
      if (!resposta.ok) {
        desfazer(
          `O robô recusou o disparo (HTTP ${resposta.status}). Avise o administrador do sistema.`,
        )
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

  return <BotaoBuscarAgora estado={estado} restanteMs={restanteMs} onBuscar={() => void buscar()} />
}
