import {} from 'dotenv/config'
import cron from 'node-schedule'

import { startScrapingCU } from './cines-unidos'

async function startScraping() {
  try {
    await startScrapingCU()
  } catch (error) {
    console.error(error)
  }
}

startScraping()

cron.scheduleJob('0 */8 * * *', (fireDate) => {
  console.info('FIRE DATE', fireDate)
  console.info('DATE', new Date())
  startScraping()
})
