import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ICONE_INSTALAR } from '../lib/navegacao'
import { instalarApp, useInstalacao } from '../lib/pwa'
import { BotaoFolha, FolhaApp } from './NavegacaoApp'
import { botao, botaoPrimario } from './ui'

/** Some quando o app já está instalado ou o navegador não permite instalar. */
export default function BotaoInstalarApp({
  estilo = 'folha',
  className = '',
}: {
  estilo?: 'folha' | 'botao'
  className?: string
}) {
  const modo = useInstalacao()
  const [instrucoesAbertas, setInstrucoesAbertas] = useState(false)

  if (modo === 'instalado' || modo === 'indisponivel') return null

  const abrir = () => {
    if (modo === 'nativo') void instalarApp()
    else setInstrucoesAbertas(true)
  }

  return (
    <>
      {estilo === 'folha' ? (
        <BotaoFolha rotulo="Instalar o app" d={ICONE_INSTALAR} onClick={abrir} />
      ) : (
        <button type="button" className={`${botao} ${className}`} onClick={abrir}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4" aria-hidden>
            <path d={ICONE_INSTALAR} />
          </svg>
          Instalar o app
        </button>
      )}
      {(modo === 'ios' || modo === 'manual') &&
        createPortal(
          <FolhaApp
            aberta={instrucoesAbertas}
            onFechar={() => setInstrucoesAbertas(false)}
            titulo="Instalar o Despert"
            subtitulo="Abre direto da tela inicial, em tela cheia."
            icone={<img src="/icons/icon-192.png" alt="" width={48} height={48} className="size-12 shrink-0" />}
          >
            <ol className="flex flex-col gap-3">
              {PASSOS[modo].map((passo, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{passo}</span>
                </li>
              ))}
            </ol>
            {modo === 'ios' && (
              <p className="text-sm text-muted">
                No iPhone a instalação é sempre feita por esse menu: a Apple não permite que um site se instale
                sozinho.
              </p>
            )}
            <button type="button" className={botaoPrimario} onClick={() => setInstrucoesAbertas(false)}>
              Entendi
            </button>
          </FolhaApp>,
          document.body,
        )}
    </>
  )
}

function IconeCompartilhar() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="ícone Compartilhar"
      className="inline-block align-text-bottom"
    >
      <path d="M12 3v12M8 7l4-4 4 4M8 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-2" />
    </svg>
  )
}

const PASSOS: Record<'ios' | 'manual', ReactNode[]> = {
  ios: [
    <>
      Toque em <strong>Compartilhar</strong> <IconeCompartilhar /> na barra do Safari.
    </>,
    <>
      Role as opções e toque em <strong>Adicionar à Tela de Início</strong>.
    </>,
    <>
      Confirme em <strong>Adicionar</strong>. O selo do Despert aparece junto dos seus apps.
    </>,
  ],
  manual: [
    <>
      Abra o menu do navegador (<strong>⋮</strong> no canto da tela).
    </>,
    <>
      Toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.
    </>,
    <>Confirme. O selo do Despert aparece junto dos seus apps.</>,
  ],
}
