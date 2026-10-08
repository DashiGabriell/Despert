import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { rotaInicial } from './domain/acesso'
import { useAuth } from './lib/auth-context'
import Agenda from './pages/Agenda'
import Auditoria from './pages/Auditoria'
import Checkout from './pages/Checkout'
import CheckoutRetorno from './pages/CheckoutRetorno'
import Configuracoes from './pages/Configuracoes'
import Convite from './pages/Convite'
import AreaDev from './pages/dev/AreaDev'
import PaginaDev from './pages/dev/PaginaDev'
import Equipe from './pages/Equipe'
import Historico from './pages/Historico'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Monitoramento from './pages/Monitoramento'
import Prazos from './pages/Prazos'

/** Visitante vê a landing page; quem já tem sessão vai direto para a aplicação. */
function Inicio() {
  const { sessao, papel, atuacao } = useAuth()
  if (sessao === undefined) return null
  if (sessao) return <Navigate to={rotaInicial(papel, atuacao !== null)} replace />
  return <Landing />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/login" element={<Login />} />
      <Route path="/convite/:token" element={<Convite />} />
      <Route path="/dashitecnology" element={<AreaDev />}>
        <Route index element={<Navigate to="visao-geral" replace />} />
        <Route path=":modo" element={<PaginaDev />} />
      </Route>
      <Route element={<Layout />}>
        <Route path="/prazos" element={<Prazos />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/monitoramento" element={<Monitoramento />} />
        <Route path="/historico" element={<Historico />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/checkout/retorno" element={<CheckoutRetorno />} />
        <Route path="/equipe" element={<Equipe />} />
        <Route path="/auditoria" element={<Auditoria />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
