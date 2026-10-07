/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { calcularVencimento, ehDiaUtil, proximoDiaUtil, type DataISO } from './dias'

// O Vitest roda a partir de web/.
const fluxo = (arquivo: string) => readFileSync(join(process.cwd(), '..', 'n8n', arquivo), 'utf8')
const roboJson = fluxo('monitor-prazos-djen-supabase.n8n.json')
const convitesJson = fluxo('convites-despert.n8n.json')

interface No {
  name: string
  type: string
  parameters: { jsCode?: string }
}

interface Regra {
  ehDiaUtil(iso: DataISO): boolean
  proximoDiaUtil(iso: DataISO): DataISO
  calcularVencimento(inicio: DataISO, dias: number): DataISO
}

const nos = (texto: string): No[] => (JSON.parse(texto) as { nodes: No[] }).nodes

function regraDoRobo(): (feriados: string[], recesso: boolean) => Regra {
  const codigo = nos(roboJson).find((n) => n.name === 'Processar Publicações')?.parameters.jsCode ?? ''
  const inicio = codigo.indexOf('// <regra-vencimento>')
  const fim = codigo.indexOf('// </regra-vencimento>')
  if (inicio < 0 || fim < inicio) throw new Error('Trecho da regra de vencimento não encontrado no n8n')
  return new Function(`${codigo.slice(inicio, fim)}\nreturn criarRegra;`)() as (f: string[], r: boolean) => Regra
}

function datas(de: DataISO, quantidade: number): DataISO[] {
  const lista: DataISO[] = []
  const atual = new Date(`${de}T00:00:00Z`)
  for (let i = 0; i < quantidade; i++) {
    lista.push(atual.toISOString().slice(0, 10))
    atual.setUTCDate(atual.getUTCDate() + 1)
  }
  return lista
}

describe('paridade da regra de vencimento com o robô (ADR-0002)', () => {
  const criarRegra = regraDoRobo()
  const cenarios = [
    { nome: 'com recesso, sem feriados locais', feriados: [], recesso: true },
    { nome: 'sem recesso', feriados: [], recesso: false },
    { nome: 'com feriados locais', feriados: ['2026-01-25', '2026-07-09', '2027-11-30', '2028-02-29'], recesso: true },
  ]

  it.each(cenarios)('dia útil e próximo dia útil iguais ($nome)', ({ feriados, recesso }) => {
    const robo = criarRegra(feriados, recesso)
    const opcoes = { feriadosLocais: feriados, considerarRecesso: recesso }
    for (const dia of datas('2025-11-01', 1300)) {
      expect([dia, robo.ehDiaUtil(dia)]).toEqual([dia, ehDiaUtil(dia, opcoes)])
      expect([dia, robo.proximoDiaUtil(dia)]).toEqual([dia, proximoDiaUtil(dia, opcoes)])
    }
  })

  it.each(cenarios)('vencimento igual para prazos de 1 a 60 dias ($nome)', ({ feriados, recesso }) => {
    const robo = criarRegra(feriados, recesso)
    const opcoes = { feriadosLocais: feriados, considerarRecesso: recesso }
    for (const inicio of datas('2025-12-01', 500).filter((_, i) => i % 3 === 0)) {
      for (const dias of [1, 2, 5, 10, 15, 30, 60]) {
        expect([inicio, dias, robo.calcularVencimento(inicio, dias)]).toEqual([
          inicio,
          dias,
          calcularVencimento(inicio, dias, opcoes),
        ])
      }
    }
  })
})

describe('fluxos do n8n', () => {
  it.each([
    ['robô', roboJson],
    ['convites', convitesJson],
  ])('o código de todos os nós do fluxo de %s é JavaScript válido', (_, texto) => {
    const codigos = nos(texto).filter((n) => n.type === 'n8n-nodes-base.code')
    expect(codigos.length).toBeGreaterThan(0)
    for (const n of codigos) {
      expect(() => new Function(n.parameters.jsCode ?? ''), n.name).not.toThrow()
    }
  })
})
