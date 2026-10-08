import '@testing-library/jest-dom/vitest'

// jsdom não implementa rolagem; a troca de tela rola para o topo como num app
window.scrollTo = () => undefined
