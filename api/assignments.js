import { createAssignmentsHandler } from './_lib/assignmentsHandler.js'
import { admin } from './_lib/admin.js'
import { rateCheck } from './_lib/rate.js'
import { requireUser } from './_lib/requireUser.js'

export default createAssignmentsHandler({
  requireUser,
  findApp: async (id) => {
    const { data, error } = await admin().from('hub_apps').select('id, base_url, revoked').eq('id', id).maybeSingle()
    if (error) throw error
    return data
  },
  createAssignment: async (a) => {
    const { data, error } = await admin().rpc('hub_create_assignment', {
      p_teacher: a.teacher, p_app: a.app, p_class: a.class_id, p_title: a.title, p_deep_link: a.deep_link,
      p_task_type: a.task_type, p_domain: a.domain_id, p_due: a.due_at, p_student_ids: a.student_ids,
    })
    if (error) throw error
    return data
  },
  rateCheck,
})
