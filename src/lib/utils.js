import { inspect } from 'util'

export function getTheaters(cityMovies, city) {
  const cityInfo = cityMovies[city] || {}
  return cityInfo.theaters || []
}

export function getMovies(cityMovies, city, theater, search) {
  const cityInfo = cityMovies[city] || {}

  const theaterObj = (cityInfo.theaters || []).find((cityTheater) => {
    return (
      cityTheater.id === theater || cityTheater.room.replace(' ', '') === theater.replace(' ', '')
    )
  })

  const movies = (cityInfo.theaterMovies || {})[(theaterObj || {}).id] || []

  return search ? movies.filter((movie) => (movie.title || '').includes(search)) || [] : movies
}

export function sortByMonth(arr) {
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

export function log(data) {
  console.info(inspect(data, { showHidden: false, depth: null }))
}
