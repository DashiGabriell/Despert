import CartaoVazio from '../components/CartaoVazio'

export default function Prazos() {
  return (
    <CartaoVazio
      titulo="Nenhuma publicação capturada ainda"
      descricao={
        <>
          Cadastre uma OAB em <strong>Monitoramento</strong> e use <strong>Buscar agora</strong> para
          o robô consultar o Diário. Esta tela é montada no ticket de lista de prazos.
        </>
      }
    />
  )
}
