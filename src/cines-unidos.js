import chrome from 'chrome-aws-lambda'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { log } from './lib/utils'

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

async function scrapePremieres() {
  const browser = await puppeteer.launch({
    args: chrome.args,
    executablePath: await chrome.executablePath,
    headless: true,
    timeout: 0
  })
  const page = await browser.newPage()
  let result = []

  try {
    await page.goto('https://www.cinesunidos.com/Estrenos', {
      timeout: 0,
      waitUntil: 'load'
    })

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
  const browser = !defBrowser
    ? await puppeteer.launch({
        args: chrome.args,
        executablePath: await chrome.executablePath,
        headless: true,
        timeout: 0
      })
    : defBrowser
  const page = await browser.newPage()
  let result = {}

  try {
    await page.goto(`https://www.cinesunidos.com/Cines/${head}`, {
      timeout: 0,
      waitUntil: 'load'
    })

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
          await new Promise((resolve) => setTimeout(resolve, 500))

          const moviesElements = document
            .getElementById(`M_${theaterId}`)
            .getElementsByClassName('row margin-info')
          const movies = []

          for (const element of moviesElements) {
            const children = element.children
            const info = children[0].children[0].children[0]

            const schedules = Array.from(children[1].children[0].children).map((child) => ({
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

      data.forEach((item) => {
        const movies = item.movies || []
        if (!theaterMovies[item.theaterId]) {
          theaterMovies[item.theaterId] = []
        }

        movies.forEach((movie) => {
          const movieIndex = theaterMovies[item.theaterId].findIndex(
            (tMovie) => tMovie.title === movie.title
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

export async function startScrapingCU() {
  try {
    const premieres = await scrapePremieres()
    await scrapeMovies(CITIES)

    log(premieres)
    console.info('/***************/')
    console.info('/***************/')
    console.info('/***************/')
    log(cityMovies)
  } catch (error) {
    console.error(error)
  }
}
