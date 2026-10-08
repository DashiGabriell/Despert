import { Link, useSearchParams } from 'react-router-dom'
import { resultadoDoRetorno, type ResultadoRetorno } from '../domain/checkout'

const TEXTO: Record<ResultadoRetorno, { titulo: string; corpo: string }> = {
  pago: {
    titulo: 'Pagamento enviado',
    corpo: 'O plano muda quando o Asaas confirmar. Pode levar um instante. Até lá, a situação da organização continua a mesma.',
  },
  cancelado: {
    titulo: 'Pagamento cancelado',
    corpo: 'Nada foi contratado. Você pode gerar outro pagamento quando quiser.',
  },
  expirado: {
    titulo: 'Link expirado',
    corpo: 'Esse pagamento não está mais disponível. Gere outro para continuar.',
  },
}

export default function CheckoutRetorno() {
  const [parametros] = useSearchParams()
  const resultado = resultadoDoRetorno(parametros.get('resultado'))
  const texto = resultado
    ? TEXTO[resultado]
    : {
        titulo: 'Retorno não reconhecido',
        corpo: 'Não identificamos o resultado desse pagamento.',
      }

  return (
    <div className="mx-auto max-w-xl">
      <section className="ds-card p-8" aria-labelledby="titulo-retorno">
        <p className="text-xs font-bold tracking-wider text-muted uppercase">Asaas</p>
        <h1 id="titulo-retorno" className="mt-2 text-4xl leading-tight font-bold text-navy">
          {texto.titulo}
        </h1>
        <p className="mt-4 leading-relaxed text-ink/85">{texto.corpo}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/checkout" className="ds-btn ds-btn-primary">
            Ver planos
          </Link>
          <Link to="/prazos" className="ds-btn ds-btn-outline">
            Ir para os prazos
          </Link>
        </div>
      </section>
    </div>
  )
}
