const MASCARA_CNJ = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/

/** Aceita a máscara do CNJ ou os 20 dígitos puros. */
export function validarCNJ(valor: string): boolean {
  const bruto = String(valor ?? '').trim()
  if (MASCARA_CNJ.test(bruto)) return true
  return /^\d{20}$/.test(bruto)
}

/** Aplica a máscara `NNNNNNN-DD.AAAA.J.TR.OOOO` quando há 20 dígitos. */
export function formatarCNJ(valor: string): string {
  const original = String(valor ?? '')
  const digitos = original.replace(/\D/g, '')
  if (digitos.length !== 20) return original
  return digitos.replace(
    /^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$/,
    '$1-$2.$3.$4.$5.$6',
  )
}
