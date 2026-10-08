import { describe, expect, it } from 'vitest'
import { gerarCsv } from './csv'

describe('gerarCsv', () => {
  it('começa com BOM, separa por ; e termina as linhas com CRLF', () => {
    expect(gerarCsv(['Processo', 'Órgão'], [['123', 'Vara Cível']])).toBe('\uFEFFProcesso;Órgão\r\n123;Vara Cível\r\n')
  })

  it('põe entre aspas o que tem ;, aspas ou quebra de linha', () => {
    const csv = gerarCsv(['a', 'b', 'c'], [['x;y', 'diz "oi"', 'linha 1\nlinha 2']])
    expect(csv.split('\r\n')[1]).toBe('"x;y";"diz ""oi""";"linha 1\nlinha 2"')
  })

  it('células vazias para nulo e indefinido; números com vírgula decimal', () => {
    expect(gerarCsv(['a', 'b', 'c', 'd'], [[null, undefined, 15, 2.5]]).split('\r\n')[1]).toBe(';;15;2,5')
  })

  it('neutraliza textos que o Excel leria como fórmula', () => {
    const linha = gerarCsv(['a', 'b', 'c'], [['=SOMA(A1)', '+55 11', '@x']]).split('\r\n')[1]
    expect(linha).toBe("'=SOMA(A1);'+55 11;'@x")
  })
})
