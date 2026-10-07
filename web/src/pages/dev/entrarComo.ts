import { useNavigate } from 'react-router-dom'
import { useRegistrarAuditoria } from '../../data/admin'
import { useAuth } from '../../lib/auth-context'
import { mensagemDeErro, useToast } from '../../lib/toast-context'

/** Abre a aplicação do advogado com os dados dele; a ação fica na auditoria. */
export function useEntrarComo() {
  const { sessao, iniciarAtuacao } = useAuth()
  const registrar = useRegistrarAuditoria()
  const navigate = useNavigate()
  const avisar = useToast()

  return async (conta: { id: string; email: string }) => {
    if (!sessao) return
    try {
      await registrar.mutateAsync({
        devId: sessao.user.id,
        devEmail: sessao.user.email,
        acao: 'atuar_como',
        alvoUserId: conta.id,
        alvoEmail: conta.email,
      })
    } catch (erro) {
      avisar(`Não foi possível registrar na auditoria: ${mensagemDeErro(erro)}`, 'erro')
      return
    }
    iniciarAtuacao({ userId: conta.id, email: conta.email })
    navigate('/prazos')
  }
}
