import { Link } from 'react-router-dom'
import AgendaContagem from '../components/AgendaContagem'
import { ROTULO_PLANO, PLANOS } from '../domain/planos'
import { comparacaoDosPlanos, faixaDeUsuarios, formatarPreco, PRECO_MENSAL } from '../domain/precos'
import type { Plano } from '../lib/database.types'
import './landing.css'

const CADASTRO = '/login?criar=1'

const PARA_QUEM: Record<Plano, string> = {
  solo: 'Para quem advoga sozinho.',
  escritorio: 'Para escritórios com equipe.',
  corporativo: 'Para departamentos jurídicos de empresa.',
}

const PERGUNTAS: readonly [string, string][] = [
  [
    'Quais tribunais o Despert cobre?',
    'Os que publicam no Diário de Justiça Eletrônico Nacional (DJEN), a publicação oficial do CNJ onde os tribunais do país publicam intimações. O Despert lê o DJEN; não consulta outros diários.',
  ],
  [
    'E se a publicação não disser o prazo?',
    'O prazo entra com o número de dias padrão que você define nas configurações e fica marcado “Para conferir”, assim como textos com mais de um prazo ou prazo em horas. Você ajusta os dias e o vencimento é recalculado.',
  ],
  [
    'Feriados locais entram na conta?',
    'Os feriados nacionais já vêm no cálculo. Os estaduais, os municipais e as suspensões de expediente você cadastra uma vez e passam a valer nos prazos calculados a partir daí; os que já existem você ajusta na edição. O recesso forense de 20/12 a 20/01 é considerado, se você quiser.',
  ],
  [
    'O que acontece quando o teste termina?',
    'Você tem 15 dias para regularizar: nos 5 primeiros tudo funciona, com aviso; depois a conta fica somente leitura, com o robô ainda buscando e avisando. Passado o dia 15, o robô para e você continua lendo e exportando seus dados. Nada é apagado.',
  ],
  ['Como é o pagamento?', 'Mensal, por Pix ou boleto. Ainda não há plano anual.'],
]

function Selo({ className = '' }: { className?: string }) {
  return <img src="/logo-despert-256.png" alt="" className={`shrink-0 object-contain ${className}`} />
}

function Abertura() {
  return (
    <div className="flex h-full flex-col">
      <h1 className="text-[2.6rem] leading-[1.02] font-bold text-balance text-navy sm:text-5xl lg:text-[3.1rem]">
        O Diário publica.
        <br />
        <span className="text-primary">O Despert conta o prazo.</span>
      </h1>
      <p className="mt-4 max-w-[52ch] text-base leading-relaxed text-ink/85 sm:text-lg">
        Todo dia útil, o robô lê o Diário de Justiça Eletrônico Nacional, encontra as intimações da sua OAB e calcula o
        vencimento em dias úteis, com feriados e recesso. Logo depois das 7h, a lista chega no seu e-mail.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 lg:mt-auto lg:pt-6">
        <Link to={CADASTRO} className="ds-btn ds-btn-primary px-6 text-base">
          Começar teste grátis
        </Link>
        <p className="text-sm text-muted">7 dias, sem cartão de crédito.</p>
      </div>
    </div>
  )
}

function Publicacao() {
  return (
    <section id="como-funciona" className="scroll-mt-20 py-20 sm:py-28">
      <div className="max-w-[40rem]">
        <h2 className="text-4xl leading-tight font-bold text-balance text-navy sm:text-5xl">
          Da publicação ao vencimento, sem abrir o Diário
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-ink/85">
          Todo dia o DJEN traz publicações de tribunais do país inteiro. O Despert separa as que intimam você e faz a
          conta que você faria à mão.
        </p>
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-14">
        <figure className="rounded-xl border border-line bg-[var(--lp-papel)] p-6 shadow-[0_18px_40px_-30px_rgba(20,33,61,0.5)] sm:p-9">
          <figcaption className="mb-5 flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-4">
            <span className="font-display text-xl font-bold text-navy">Diário de Justiça Eletrônico Nacional</span>
            <span className="ds-badge ds-badge-coin">Publicação de exemplo</span>
          </figcaption>
          <p className="text-sm text-muted">Disponibilizado em 30/09/2026 · Publicado em 01/10/2026</p>
          <p className="mt-4 text-lg leading-[1.8] text-ink">
            <strong>Intimação.</strong> Processo 0001234-56.2026.8.26.0100. Fica a parte autora, por seu advogado{' '}
            <mark className="rounded bg-info-soft px-1 text-navy">(OAB/SP 123.456)</mark>, intimada para,{' '}
            <mark className="rounded bg-primary-soft px-1 text-primary">no prazo de 15 (quinze) dias</mark>,
            manifestar-se sobre a contestação e documentos juntados.
          </p>
        </figure>

        <dl className="flex flex-col justify-center gap-8">
          <div>
            <dt className="font-display text-2xl font-bold text-navy">A sua OAB, entre milhares</dt>
            <dd className="mt-1.5 leading-relaxed text-ink/85">
              O robô busca no DJEN as publicações das OABs e dos processos que você monitora, às 7h de todo dia útil.
            </dd>
          </div>
          <div>
            <dt className="font-display text-2xl font-bold text-primary">15 dias úteis, lidos no texto</dt>
            <dd className="mt-1.5 leading-relaxed text-ink/85">
              Quando o texto não informa o prazo, traz mais de um ou fala em horas, o prazo fica marcado “Para conferir”
              em vez de virar um chute.
            </dd>
          </div>
          <div>
            <dt className="font-display text-2xl font-bold text-navy">Vencimento em 23/10</dt>
            <dd className="mt-1.5 leading-relaxed text-ink/85">
              Começa no primeiro dia útil depois da publicação e pula fins de semana, feriados nacionais, os feriados
              locais que você cadastrar e o recesso forense.
            </dd>
          </div>
        </dl>
      </div>
    </section>
  )
}

function Resumo() {
  return (
    <section className="grid items-center gap-12 border-t border-line py-20 sm:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
      <div className="max-w-[36rem]">
        <h2 className="text-4xl leading-tight font-bold text-balance text-navy sm:text-5xl">
          Às 7h, a lista do dia no seu e-mail
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-ink/85">
          O resumo diário sai todo dia útil depois da busca das 7h, mesmo quando nada vence: você sabe que o robô rodou.
          Na aplicação, a mesma lista aparece por urgência e cada vencimento ocupa o seu dia na agenda.
        </p>
      </div>

      <article
        aria-label="Resumo diário de exemplo"
        className="rounded-xl border border-line bg-card shadow-[0_24px_50px_-30px_rgba(20,33,61,0.5)]"
      >
        <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4 sm:px-6">
          <Selo className="size-10" />
          <div className="mr-auto">
            <p className="font-semibold text-navy">Despert · Resumo de prazos</p>
            <p className="text-sm text-muted">sexta-feira, 23/10/2026, 07:04</p>
          </div>
          <span className="ds-badge ds-badge-coin">Exemplo</span>
        </header>
        <div className="divide-y divide-line px-5 sm:px-6">
          <div className="py-4">
            <p className="text-sm font-semibold text-danger">Vence hoje</p>
            <p className="mt-1 text-ink">
              0001234-56.2026.8.26.0100 · Manifestação sobre a contestação
            </p>
          </div>
          <div className="py-4">
            <p className="text-sm font-semibold text-caution">Nos próximos 5 dias</p>
            <p className="mt-1 text-ink">0004321-10.2026.8.26.0002 · Contrarrazões · vence em 27/10</p>
            <p className="mt-1 text-ink">
              0007788-90.2026.8.26.0577 · Prazo de 15 dias · vence em 29/10{' '}
              <span className="ds-badge ds-badge-warning ml-1">Para conferir</span>
            </p>
          </div>
          <div className="py-4">
            <p className="text-sm font-semibold text-navy">Publicações novas</p>
            <p className="mt-1 text-ink">1 intimação encontrada hoje, já com vencimento calculado.</p>
          </div>
        </div>
      </article>
    </section>
  )
}

function Planos() {
  const linhas = comparacaoDosPlanos()
  return (
    <section id="planos" className="scroll-mt-20 border-t border-line py-20 sm:py-28">
      <div className="max-w-[40rem]">
        <h2 className="text-4xl leading-tight font-bold text-balance text-navy sm:text-5xl">Planos</h2>
        <p className="mt-4 text-lg leading-relaxed text-ink/85">
          Todo cadastro começa com 7 dias grátis nos limites do Solo. Depois, pagamento mensal por Pix ou boleto. Os
          planos com equipe são liberados pela equipe Despert depois do cadastro.
        </p>
      </div>

      <div className="mt-12 hidden overflow-hidden rounded-2xl border border-line bg-card lg:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Comparação dos planos</caption>
          <thead>
            <tr>
              <td className="w-[28%] border-b border-line" />
              {PLANOS.map((p) => (
                <th
                  key={p}
                  scope="col"
                  className={`border-b border-line p-6 align-top font-normal ${p === 'solo' ? 'bg-primary-soft' : ''}`}
                >
                  <span className="block font-display text-3xl font-bold text-navy">{ROTULO_PLANO[p]}</span>
                  <span className="mt-1 block text-sm text-muted">{PARA_QUEM[p]}</span>
                  <span className="mt-5 block">
                    <span className={`font-display text-4xl font-bold ${p === 'solo' ? 'text-primary' : 'text-navy'}`}>
                      {formatarPreco(PRECO_MENSAL[p])}
                    </span>
                    <span className="text-sm text-muted"> /mês</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={linha.rotulo}>
                <th scope="row" className="border-b border-line px-6 py-3.5 text-sm font-semibold text-ink">
                  {linha.rotulo}
                </th>
                {PLANOS.map((p) => (
                  <td
                    key={p}
                    className={`border-b border-line px-6 py-3.5 text-sm text-ink ${p === 'solo' ? 'bg-primary-soft/60' : ''}`}
                  >
                    {linha.valores[p]}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td />
              {PLANOS.map((p) => (
                <td key={p} className={`p-6 ${p === 'solo' ? 'bg-primary-soft/60' : ''}`}>
                  <Link
                    to={CADASTRO}
                    className={`ds-btn w-full ${p === 'solo' ? 'ds-btn-primary' : 'ds-btn-outline'}`}
                  >
                    {p === 'solo' ? 'Começar teste grátis' : 'Começar pelo teste'}
                  </Link>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3 lg:hidden">
        {PLANOS.map((p) => (
          <article
            key={p}
            aria-labelledby={`plano-${p}`}
            className={`flex flex-col rounded-2xl border p-5 ${p === 'solo' ? 'border-primary/30 bg-primary-soft' : 'border-line bg-card'}`}
          >
            <h3 id={`plano-${p}`} className="font-display text-3xl font-bold text-navy">
              {ROTULO_PLANO[p]}
            </h3>
            <p className="text-sm text-muted">
              {PARA_QUEM[p]} {faixaDeUsuarios(p) === '1' ? '1 usuário.' : `${faixaDeUsuarios(p)} usuários.`}
            </p>
            <p className="mt-4">
              <span className={`font-display text-4xl font-bold ${p === 'solo' ? 'text-primary' : 'text-navy'}`}>
                {formatarPreco(PRECO_MENSAL[p])}
              </span>
              <span className="text-sm text-muted"> /mês</span>
            </p>
            <dl className="mt-4 mb-5 divide-y divide-line/80 text-sm">
              {linhas
                .filter((linha) => linha.rotulo !== 'Usuários')
                .map((linha) => (
                  <div key={linha.rotulo} className="flex justify-between gap-4 py-2 md:flex-col md:gap-0.5">
                    <dt className="text-muted">{linha.rotulo}</dt>
                    <dd className="text-right font-semibold text-ink md:text-left">{linha.valores[p]}</dd>
                  </div>
                ))}
            </dl>
            <Link
              to={CADASTRO}
              className={`ds-btn mt-auto w-full ${p === 'solo' ? 'ds-btn-primary' : 'ds-btn-outline'}`}
            >
              {p === 'solo' ? 'Começar teste grátis' : 'Começar pelo teste'}
            </Link>
          </article>
        ))}
      </div>

      <p className="mt-6 text-sm text-muted">Mais de 20 usuários: preço combinado caso a caso.</p>
    </section>
  )
}

function Perguntas() {
  return (
    <section id="perguntas" className="scroll-mt-20 border-t border-line py-20 sm:py-28 lg:grid lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
      <h2 className="text-4xl leading-tight font-bold text-balance text-navy sm:text-5xl">Perguntas frequentes</h2>
      <div className="mt-8 divide-y divide-line border-y border-line lg:mt-0">
        {PERGUNTAS.map(([pergunta, resposta]) => (
          <details key={pergunta} className="group">
            <summary className="flex cursor-pointer items-center justify-between gap-6 py-5 text-lg font-semibold text-navy transition-colors hover:text-primary">
              {pergunta}
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="lp-sinal size-5 shrink-0 text-primary transition-transform duration-300"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </summary>
            <p className="max-w-[65ch] pb-6 leading-relaxed text-ink/85">{resposta}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

export default function Landing() {
  return (
    <div className="lp min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-surface">
        <nav aria-label="Principal" className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3">
          <Link to="/" className="mr-auto flex items-center gap-2.5" aria-label="Despert, início">
            <Selo className="size-10" />
            <span className="font-display text-2xl font-bold text-navy">Despert</span>
          </Link>
          <a href="#como-funciona" className="hidden text-sm font-semibold text-ink hover:text-primary md:block">
            Como funciona
          </a>
          <a href="#planos" className="hidden text-sm font-semibold text-ink hover:text-primary md:block">
            Planos
          </a>
          <a href="#perguntas" className="hidden text-sm font-semibold text-ink hover:text-primary md:block">
            Perguntas
          </a>
          <Link to="/login" className="ds-btn ds-btn-outline ds-btn-sm">
            Entrar
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-5">
        <div className="pt-6 sm:pt-10">
          <AgendaContagem abertura={<Abertura />} />
        </div>
        <Publicacao />
        <Resumo />
        <Planos />
        <Perguntas />

        <section className="flex flex-col items-center border-t border-line py-20 text-center sm:py-28">
          <Selo className="size-24 drop-shadow-[0_10px_18px_rgba(107,20,33,0.3)]" />
          <h2 className="mt-6 max-w-[18ch] text-4xl leading-tight font-bold text-balance text-navy sm:text-5xl">
            Deixe a contagem com o Despert
          </h2>
          <p className="mt-4 max-w-[46ch] text-lg leading-relaxed text-ink/85">
            Cadastre sua OAB e o robô passa a buscar suas publicações todo dia útil, com o vencimento já calculado.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            <Link to={CADASTRO} className="ds-btn ds-btn-primary px-6 text-base">
              Começar teste grátis
            </Link>
            <Link to="/login" className="text-sm font-semibold text-primary underline">
              Já tenho conta
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-6 text-sm text-muted">
          <Selo className="size-7" />
          <span className="mr-auto">© {new Date().getFullYear()} Despert · Monitor de prazos · DJEN</span>
          <Link to="/login" className="font-semibold text-ink hover:text-primary">
            Entrar
          </Link>
        </div>
      </footer>
    </div>
  )
}
