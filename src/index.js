import {} from 'dotenv/config'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import express from 'express'
// import cors from 'cors'
import bodyParser from 'body-parser'
import cron from 'node-schedule'
import TelegramBot from 'node-telegram-bot-api'

/**
 * SCRAPPING
 */
puppeteer.use(StealthPlugin())

const CITIES = [
  'Barquisimeto',
  'Caracas',
  'Guatire',
  'Maracaibo',
  'Maracay',
  'Margarita',
  'Maturin',
  'Puerto La Cruz',
  'Puerto Ordaz',
  'San Cristobal',
  'Valencia'
]

const cityMovies = {}

let premieres = []

async function scrapePremieres() {
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  let result = []

  try {
    await page.goto('https://www.cinesunidos.com/Estrenos', { timeout: 0, waitUntil: 'load' })

    result = await page.evaluate(() => {
      const data = []
      const elements = document.querySelectorAll('.release-item')

      for (const element of elements) {
        const infoSection = element.childNodes[3]
        const infoData = infoSection.children[0]
        const infoDataDetails = infoData.children[2].children[0]
        const infoSynopsis = infoSection.children[1]

        const info = {
          img: element.childNodes[1].children[0].src,
          month: infoData.children[0].children[0].innerText,
          date: infoData.children[1].children[0].innerText,
          gender: infoDataDetails.children[0].childNodes[2].textContent.trim(),
          country: infoDataDetails.children[1].childNodes[2].textContent.trim(),
          format: infoDataDetails.children[2].childNodes[2].textContent.trim(),
          duration: infoDataDetails.children[3].childNodes[2].textContent.trim(),
          title: infoSynopsis.children[0].innerText,
          synopsis: infoSynopsis.children[2].innerText
        }

        data.push(info)
      }

      return data
    })
  } catch (e) {
    console.error(e)
  }

  browser.close()
  return result
}

async function scrapeMovies([head, ...tail], defBrowser) {
  // console.info(`SECRAPING ${head}...`)
  const browser = !defBrowser ? await puppeteer.launch({ headless: true }) : defBrowser
  const page = await browser.newPage()
  let result = {}

  try {
    await page.goto(`https://www.cinesunidos.com/Cines/${head}`, { timeout: 0, waitUntil: 'load' })
    // await page.waitFor(3000)

    result = await page.evaluate(async () => {
      const theaters = []
      const data = []
      const theaterElements = document.getElementById('mnu_salasciudad').children

      for (const element of theaterElements) {
        const id = element.id
        if (!id) continue

        const room = {
          id,
          room: element.children[0].innerText
        }

        theaters.push(room)
      }

      for (let theater of theaters) {
        const theaterId = theater.id
        const dayElements = document.querySelectorAll(`[data-id="${theaterId}"]`)
        for (const day of dayElements) {
          day.click()
          await new Promise(resolve => setTimeout(resolve, 500))
          // const peliText = document.getElementsByClassName('peli')[1].innerText
          // if (peliText === 'No Hay Funciones') continue

          const moviesElements = document
            .getElementById(`M_${theaterId}`)
            .getElementsByClassName('row margin-info')
          const movies = []

          for (const element of moviesElements) {
            const children = element.children
            const info = children[0].children[0].children[0]

            const schedules = Array.from(children[1].children[0].children).map(child => ({
              url: child.href,
              time: child.innerText
            }))

            const movie = {
              title: info.innerText,
              url: info.href,
              img: info.getAttribute('rel'),
              rating: children[2].children[0].innerText,
              schedules
            }

            movies.push(movie)
          }

          const dayInfo = {
            theaterId: theater.id,
            dayOfWeek: day.childNodes[0].innerHTML,
            day: day.childNodes[1].textContent,
            movies
          }

          data.push(dayInfo)
        }
      }

      return { theaters, data }
    })
  } catch (e) {
    console.error(e)
  }

  cityMovies[head] = result

  if (tail.length > 0) {
    page.close()
    scrapeMovies(tail, browser)
  } else {
    browser.close()

    for (const key in cityMovies) {
      const city = cityMovies[key]
      if (!city) continue
      const data = city.data || []
      const theaterMovies = {}

      data.forEach(item => {
        const movies = item.movies || []
        if (!theaterMovies[item.theaterId]) {
          theaterMovies[item.theaterId] = []
        }

        movies.forEach(movie => {
          const movieIndex = theaterMovies[item.theaterId].findIndex(
            tMovie => tMovie.title === movie.title
          )
          const scheduleDay = {
            day: item.day,
            dayOfWeek: item.dayOfWeek,
            schedules: movie.schedules
          }
          if (movieIndex === -1) {
            theaterMovies[item.theaterId].push({
              title: movie.title,
              url: movie.url,
              img: movie.img,
              rating: movie.rating,
              scheduleDays: [scheduleDay]
            })
          } else {
            theaterMovies[item.theaterId][movieIndex].scheduleDays.push(scheduleDay)
          }
        })
      })

      cityMovies[key].theaterMovies = theaterMovies
    }
    console.info('DONEEE!!!!!')
  }
}

async function startScraping() {
  await scrapePremieres().then(value => {
    premieres = value
  })

  await scrapeMovies(CITIES)
}

startScraping()

cron.scheduleJob('0 */8 * * *', fireDate => {
  console.info('FIRE DATE', fireDate)
  console.info('DATE', new Date())
  startScraping()
})

/**
 * UTILS
 */
function getTheaters(city) {
  const cityInfo = cityMovies[city] || {}
  return cityInfo.theaters || []
}

function getMovies(city, theater, search) {
  const cityInfo = cityMovies[city] || {}

  const theaterObj = (cityInfo.theaters || []).find(cityTheater => {
    return (
      cityTheater.id === theater || cityTheater.room.replace(' ', '') === theater.replace(' ', '')
    )
  })

  const movies = (cityInfo.theaterMovies || {})[(theaterObj || {}).id] || []

  return search ? movies.filter(movie => (movie.title || '').includes(search)) || [] : movies
}

function sortByMonth(arr) {
  const months = [
    'ENERO',
    'FEBRERO',
    'MARZO',
    'ABRIL',
    'MAYO',
    'JUNIO',
    'JULIO',
    'AGOSTO',
    'SEPTIEMBRE',
    'OCTUBRE',
    'NOVIEMBRE',
    'DICIEMBRE'
  ]

  arr.sort((a, b) => {
    const item1 = months.indexOf((a.month || '').toLocaleUpperCase())
    const item2 = months.indexOf((b.month || '').toLocaleUpperCase())
    return item1 < item2 ? -1 : item1 > item2 ? 1 : 0
  })

  return arr
}

function scapeText(text) {
  return text.replace(/(?=[().!?-])/g, '\\')
}

/**
 * TELEGRAM BOT
 */
const bot = new TelegramBot(process.env.TELEGRAM_BOT_KEY, { polling: true })

bot.onText(/\/refetch/, msg => {
  const chatId = msg.chat.id
  startScraping()
  bot.sendMessage(chatId, 'Refetching')
})

bot.onText(/\/estrenos/, async (msg, match) => {
  const chatId = msg.chat.id
  const input = match.input.split(' ')
  input.shift()
  const search = (input || []).join(' ').toLocaleUpperCase()
  const moviePremieres = search
    ? sortByMonth(premieres).filter(premiere => premiere.month === search)
    : sortByMonth(premieres)

  if (!moviePremieres.length) {
    bot.sendMessage(chatId, 'No hay estrenos en este momento, inténtelo más tarde')
    return
  }

  for (const premiere of moviePremieres) {
    await bot.sendPhoto(chatId, premiere.img, {
      caption: `
*${scapeText(premiere.title)}*

*Estreno:* ${premiere.month} ${premiere.date}
*País:* ${premiere.country}
*Genero:* ${premiere.gender}
*Formato:* ${premiere.format}
*Duración:* ${premiere.duration}

*Sinopsis:*
${scapeText(premiere.synopsis)}
      `,
      parse_mode: 'MarkdownV2'
    })
  }
})

for (let city of CITIES) {
  bot.onText(new RegExp(`/${city.toLowerCase().replace(' ', '')}`), msg => {
    const chatId = msg.chat.id
    const theaters = getTheaters(city)

    if (!theaters.length) {
      bot.sendMessage(chatId, 'No hay cines en este momento, inténtelo más tarde')
      return
    }
    let response = 'Se consiguieron los siguientes cines:\n\n'
    theaters.forEach(theater => {
      response += `/cine${theater.room.replace(' ', '')}\n\n`
    })

    bot.sendMessage(chatId, scapeText(response))
  })
}

bot.onText(new RegExp(`/cine`), async (msg, match) => {
  const chatId = msg.chat.id
  const input = match.input.split(' ')
  input.shift()
  const search = (input || []).join(' ')
  const theater = match.input.replace('/cine', '')
  let city = ''

  for (let key in cityMovies) {
    const theaters = getTheaters(key)
    const theaterObj = theaters.find(theaterItem => theaterItem.room.replace(' ', '') === theater)
    if (theaterObj) {
      city = key
      break
    }
  }

  const movies = getMovies(city, theater, search)

  if (!city || !movies.length) {
    bot.sendMessage(chatId, 'No hay funciones en este momento, inténtelo más tarde')
    return
  }

  for (let movie of movies) {
    let caption = `
*[${scapeText(movie.title)}](${movie.url})*
*Rating:* ${movie.rating}`

    const scheduleDays = movie.scheduleDays || []
    scheduleDays.forEach(scheduleDay => {
      caption += `\n\n*${scheduleDay.dayOfWeek}*\n`
      const schedules = scheduleDay.schedules || []

      schedules.forEach((schedule, i) => {
        const index = i + 1
        caption += `[${schedule.time.toLocaleUpperCase()}](${schedule.url})${
          index % 3 === 0 && index !== schedules.length ? '\n\n' : '  '
        }`
      })
    })

    await bot.sendPhoto(chatId, movie.img, {
      caption,
      parse_mode: 'MarkdownV2'
    })
  }
})

bot.on('polling_error', err => console.error(err))

/**
 * API ROUTER
 */
const app = express()
const PORT = process.env.API_PORT || 4000

// app.use(cors())
app.use(bodyParser.json())
app.use(
  bodyParser.urlencoded({
    extended: true
  })
)

app.get('/', (req, res) => {
  res.status(200).json({
    data: 'API'
  })
})

app.get('/refetch', (req, res) => {
  startScraping()
  res.status(200).json({
    data: 'Fetched'
  })
})

app.get('/premieres', (req, res) => {
  res.status(200).json({
    data: sortByMonth(premieres || [])
  })
})

app.get('/city/:city', (req, res) => {
  const { city } = req.params || {}
  res.status(200).json({ data: getTheaters(city) })
})

app.get('/city/:city/:theater', (req, res) => {
  const { city, theater } = req.params || {}
  res.status(200).json({ data: getMovies(city, theater) })
})

app.listen({ port: PORT }, () => {
  console.info(`\n\n🚀 Server ready at http://localhost:${PORT}\n\n`)
})
