import {} from 'dotenv/config'
import TelegramBot from 'node-telegram-bot-api'

const bot = new TelegramBot(process.env.TELEGRAM_BOT_KEY, { polling: true })

// TODO: sortByMonth getTheaters getMovies

function scapeText(text) {
  return text.replace(/(?=[().!?-])/g, '\\')
}

bot.onText(/\/estrenos/, async (msg, match) => {
  const chatId = msg.chat.id
  const input = match.input.split(' ')
  input.shift()
  const search = (input || []).join(' ').toLocaleUpperCase()
  const moviePremieres = search
    ? sortByMonth(premieres).filter((premiere) => premiere.month === search)
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
      parse_mode: 'MarkdownV2',
    })
  }
})

for (let city of CITIES) {
  bot.onText(new RegExp(`/${city.toLowerCase().replace(' ', '')}`), (msg) => {
    const chatId = msg.chat.id
    const theaters = getTheaters(city)

    if (!theaters.length) {
      bot.sendMessage(chatId, 'No hay cines en este momento, inténtelo más tarde')
      return
    }
    let response = 'Se consiguieron los siguientes cines:\n\n'
    theaters.forEach((theater) => {
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
    const theaterObj = theaters.find((theaterItem) => theaterItem.room.replace(' ', '') === theater)
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
    scheduleDays.forEach((scheduleDay) => {
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
      parse_mode: 'MarkdownV2',
    })
  }
})

bot.on('polling_error', (err) => console.error(err))
