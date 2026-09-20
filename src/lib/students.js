import { supabase } from './supabase.js'
import { generateCode, parseCodeList, isValidCode } from '../../shared/codes.js'

const UNIQUE_VIOLATION = '23505'

// Génère `count` codes (les collisions, très rares, sont retentées). Retourne le nombre ajouté.
export async function addGeneratedCodes(classId, count) {
  let added = 0
  for (let guard = 0; added < count && guard < count * 5; guard++) {
    const { error } = await supabase.from('hub_students').insert({ class_id: classId, code: generateCode() })
    if (!error) added++
    else if (error.code !== UNIQUE_VIOLATION) throw error
  }
  return added
}

// Adopte une liste de codes existants. `conflicts` = codes déjà pris (autre classe), `invalid` = format refusé.
export async function addPastedCodes(classId, text) {
  const codes = parseCodeList(text)
  const invalid = codes.filter((c) => !isValidCode(c))
  const added = []
  const conflicts = []
  for (const code of codes.filter(isValidCode)) {
    const { error } = await supabase.from('hub_students').insert({ class_id: classId, code })
    if (!error) added.push(code)
    else if (error.code === UNIQUE_VIOLATION) conflicts.push(code)
    else throw error
  }
  return { added, conflicts, invalid }
}

// Code perdu ou compromis : nouveau code pour le même élève (l'historique est conservé).
export async function regenerateCode(studentId) {
  for (let i = 0; i < 5; i++) {
    const { error } = await supabase.from('hub_students').update({ code: generateCode() }).eq('id', studentId)
    if (!error) return
    if (error.code !== UNIQUE_VIOLATION) throw error
  }
  throw new Error('Impossible de générer un code unique, réessayez.')
}

export async function removeStudent(studentId) {
  const { error } = await supabase.from('hub_students').delete().eq('id', studentId)
  if (error) throw error
}
