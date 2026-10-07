import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const preenchido =
  Boolean(url && anonKey) && !url!.includes('SEU-PROJETO') && !anonKey!.includes('SUA-CHAVE')

/** A aplicação só funciona com o Supabase configurado; a ausência gera um aviso claro na tela. */
export const supabaseConfigurado = preenchido

export const ausenciaConfiguracao = preenchido
  ? null
  : 'Supabase não configurado: copie .env.example para .env e preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.'

export const supabase: SupabaseClient<Database> | null = preenchido
  ? createClient<Database>(url!, anonKey!)
  : null
