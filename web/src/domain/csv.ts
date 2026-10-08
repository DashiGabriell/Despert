export type Celula = string | number | null | undefined

/** Começo que o Excel interpretaria como fórmula. */
const FORMULA = /^[=+\-@\t\r]/

function celula(valor: Celula): string {
  if (valor === null || valor === undefined) return ''
  let texto = typeof valor === 'number' ? String(valor).replace('.', ',') : valor
  if (typeof valor === 'string' && FORMULA.test(texto)) texto = `'${texto}`
  return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

/**
 * CSV que o Excel em pt-BR abre direto: BOM UTF-8 (acentos), `;` como separador, quebra de linha
 * CRLF e vírgula decimal. Datas devem chegar já formatadas (`dd/mm/aaaa`).
 */
export function gerarCsv(cabecalho: readonly string[], linhas: readonly (readonly Celula[])[]): string {
  return `\uFEFF${[cabecalho, ...linhas].map((linha) => linha.map(celula).join(';')).join('\r\n')}\r\n`
}
