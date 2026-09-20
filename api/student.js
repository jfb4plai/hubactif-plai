import { createStudentHandler } from './_lib/studentHandler.js'
import { admin } from './_lib/admin.js'
import { rateCheck } from './_lib/rate.js'

export default createStudentHandler({
  studentTasks: async (classCode, studentCode) => {
    const { data, error } = await admin().rpc('hub_student_tasks', { p_class_code: classCode, p_student_code: studentCode })
    if (error) throw error
    return data
  },
  rateCheck,
})
