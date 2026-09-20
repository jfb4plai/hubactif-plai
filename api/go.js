import { createGoHandler } from './_lib/goHandler.js'
import { admin } from './_lib/admin.js'
import { rateCheck } from './_lib/rate.js'

export default createGoHandler({
  openLink: async (id) => {
    const { data, error } = await admin().rpc('hub_open_link', { p_link: id })
    if (error) throw error
    return data?.[0] ?? null
  },
  rateCheck,
  privateKey: process.env.HUB_SIGNING_PRIVATE_KEY,
})
