import { useState } from 'react'
import { Link } from 'react-router-dom'
import { alertaErro, botaoPrimario, dica } from '../components/ui'
import { abrirPagamento, useContratar } from '../data/checkout'
import { planoMenor, podeContratar } from '../domain/checkout'
import { PLANOS, ROTULO_PLANO } from '../domain/planos'
import { faixaDeUsuarios, formatarPreco, PRECO_MENSAL } from '../domain/precos'
import type { Plano } from '../lib/database.types'
import { useAuth } from '../lib/auth-context'
import { usePertenca } from '../lib/organizacao-context'
import { mensagemDeErro } from '../lib/toast-context'

const PARA_QUEM: Record<Plano, string> = {
  solo: 'Para quem advoga sozinho.',
  escritorio: 'Para escritórios com equipe.',
  corporativo: 'Para departamentos jurídicos de empresa.',
}

export default function Checkout() {
  const { papel, organizacao } = usePertenca()
  const { atuacao } = useAuth()
  const contratar = useContratar()
  const [falha, setFalha] = useState<string | null>(null)
  const administrador = podeContratar(papel) && !atuacao

  async function pagar(plano: Plano) {
    setFalha(null)
    try {
      const url = await contratar.mutateAsync({ organizacaoId: organizacao.id, plano })
      abrirPagamento(url)
    } catch (erro) {
      setFalha(mensagemDeErro(erro))
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-4xl leading-tight font-bold text-navy">Contratar</h1>
      <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-ink/85">
        A mensalidade abre na página do Asaas, por Pix ou cartão. O Despert não vê os dados do pagamento. O plano só
        muda quando o Asaas confirma.
      </p>

      {!administrador && (
        <p className={`${dica} mt-6`}>
          {atuacao
            ? 'Encerre a atuação para contratar com a sua própria conta.'
            : 'Só o Administrador da organização contrata o plano.'}
        </p>
      )}

      {falha && <div className={`${alertaErro} mt-6`}>{falha}</div>}

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        {PLANOS.map((plano) => {
          const atual = plano === organizacao.plano
          return (
            <article
              key={plano}
              aria-labelledby={`checkout-${plano}`}
              className={`flex flex-col rounded-2xl border p-5 ${atual ? 'border-primary/30 bg-primary-soft' : 'border-line bg-card'}`}
            >
              <h2 id={`checkout-${plano}`} className="font-display text-3xl font-bold text-navy">
                {ROTULO_PLANO[plano]}
              </h2>
              <p className="text-sm text-muted">{PARA_QUEM[plano]}</p>
              <p className="mt-4">
                <span className={`font-display text-4xl font-bold ${atual ? 'text-primary' : 'text-navy'}`}>
                  {formatarPreco(PRECO_MENSAL[plano])}
                </span>
                <span className="text-sm text-muted"> /mês</span>
              </p>
              <p className="mt-2 text-sm text-ink">{faixaDeUsuarios(plano) === '1' ? '1 usuário' : `${faixaDeUsuarios(plano)} usuários`}</p>
              {atual && <p className="mt-3 text-sm font-semibold text-primary">Plano atual</p>}
              {administrador && planoMenor(organizacao.plano, plano) && (
                <p className={`${dica} mt-3`}>
                  Plano menor: nada é apagado. O que passar do limite é pausado ou vira Leitura.
                </p>
              )}
              {administrador && (
                <button
                  type="button"
                  className={`${botaoPrimario} mt-auto w-full`}
                  disabled={contratar.isPending}
                  onClick={() => void pagar(plano)}
                >
                  {contratar.isPending ? 'Abrindo pagamento…' : `Pagar ${formatarPreco(PRECO_MENSAL[plano])}`}
                </button>
              )}
            </article>
          )
        })}
      </div>

      <p className="mt-6 text-sm text-muted">
        Mais de 20 usuários: preço combinado caso a caso.{' '}
        <Link to="/configuracoes" className="font-semibold text-primary hover:underline">
          Voltar às configurações
        </Link>
      </p>
    </div>
  )
}
