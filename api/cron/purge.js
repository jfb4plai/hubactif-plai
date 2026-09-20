import { createPurgeHandler } from '../_lib/purgeHandler.js'
import { admin } from '../_lib/admin.js'

export default createPurgeHandler({
  secret: process.env.CRON_SECRET,
  purge: async () => {
    const { data, error } = await admin().rpc('hub_purge_stale')
    if (error) throw error
    return data
  },
})
