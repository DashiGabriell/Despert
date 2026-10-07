import { Navigate, useParams } from 'react-router-dom'
import { ehModoDev, rotaDev, rotuloModoDev, type ModoDev } from '../../domain/acesso'
import Auditoria from './Auditoria'
import Dados from './Dados'
import ExecucoesGlobais from './ExecucoesGlobais'
import IntegracaoN8n from './IntegracaoN8n'
import Organizacoes from './Organizacoes'
import Usuarios from './Usuarios'
import VisaoGeral from './VisaoGeral'

const SUBTITULOS: Record<ModoDev, string> = {
  'visao-geral': 'Saúde do sistema, do robô e dos prazos de todas as contas.',
  usuarios: 'Contas, papéis, senhas, bloqueios e acesso como advogado.',
  organizacoes: 'Planos, limites, pagamentos, teste e carência. Só o dev vê e altera.',
  dados: 'Consulta dos dados de qualquer advogado, sem alterar nada.',
  execucoes: 'Todas as rodadas do robô, inclusive as falhas gerais.',
  n8n: 'Conexão do site com o robô. Configuração exclusiva do dev.',
  auditoria: 'Tudo o que os devs fizeram, com data e conta afetada.',
}

function Conteudo({ modo }: { modo: ModoDev }) {
  switch (modo) {
    case 'visao-geral':
      return <VisaoGeral />
    case 'usuarios':
      return <Usuarios />
    case 'organizacoes':
      return <Organizacoes />
    case 'dados':
      return <Dados />
    case 'execucoes':
      return <ExecucoesGlobais />
    case 'n8n':
      return <IntegracaoN8n />
    case 'auditoria':
      return <Auditoria />
  }
}

export default function PaginaDev() {
  const { modo } = useParams()
  if (!ehModoDev(modo)) return <Navigate to={rotaDev()} replace />
  return (
    <>
      <header className="mb-7">
        <h1 className="text-4xl leading-tight font-bold text-navy">{rotuloModoDev(modo)}</h1>
        <p className="mt-1 text-sm text-muted">{SUBTITULOS[modo]}</p>
      </header>
      <div key={modo} className="ds-entrar">
        <Conteudo modo={modo} />
      </div>
    </>
  )
}
