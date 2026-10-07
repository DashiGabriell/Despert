import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Agenda from './pages/Agenda'
import Configuracoes from './pages/Configuracoes'
import AreaDev from './pages/dev/AreaDev'
import PaginaDev from './pages/dev/PaginaDev'
import Historico from './pages/Historico'
import Login from './pages/Login'
import Monitoramento from './pages/Monitoramento'
import Prazos from './pages/Prazos'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashitecnology" element={<AreaDev />}>
        <Route index element={<Navigate to="visao-geral" replace />} />
        <Route path=":modo" element={<PaginaDev />} />
      </Route>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/prazos" replace />} />
        <Route path="/prazos" element={<Prazos />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/monitoramento" element={<Monitoramento />} />
        <Route path="/historico" element={<Historico />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
      </Route>
      <Route path="*" element={<Navigate to="/prazos" replace />} />
    </Routes>
  )
}
