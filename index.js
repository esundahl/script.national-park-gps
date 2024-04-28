const GEOJson = require('geojson')
const fs = require('fs').promises

const API_KEY = '<API_KEY>'
const API_URL = 'https://developer.nps.gov/api/v1'

async function main() {
  // Create Directories
  await fs.mkdir('dist/parks', { recursive: true })
  await fs.mkdir('cache/places', { recursive: true })

  // Fetch Data
  const parks = await fetchParks().then(parks => parks.reduce(async (curr, park) => {
    const agg = await curr
    console.log('Fetching', park.fullName)
    return [...agg, { ...park, places: await fetchPlaces(park.parkCode) }]
  }, []))
  const mappedParks = parks.map(({ latitude, longitude, fullName, description, url }) => ({ latitude, longitude, name: fullName, icon: 'red-pin-down.png', notes: `${fullName}\n${url}\n\n${description}` }))

  // Save GEOJson 
  await fs.writeFile('dist/national-parks.geojson', JSON.stringify(GEOJson.parse(mappedParks, { Point: ['latitude', 'longitude'], include: ['name', 'notes', 'icon'] })))
  await parks.reduce(async (curr, park) => {
    await curr
    console.log('Saving', park.fullName)
    const mappedPlaces = park.places.map(({ latitude, longitude, title, bodyText, url }) => ({ latitude, longitude, name: title, icon: 'red-pin-down.png', notes: `${title}\n${url}\n\n${bodyText}` }))
    await fs.writeFile(`dist/parks/${park.fullName}.geojson`, JSON.stringify(GEOJson.parse(mappedPlaces, { Point: ['latitude', 'longitude'], include: ['name', 'notes', 'icon'] }), null, 2))
  }, [])
}

main()

async function fetchParks(result = []) {
  const cacheFile = 'cache/parks.json'
  const cache = await fs.readFile(cacheFile).catch(err => 0)
  if (cache) return JSON.parse(cache.toString())

  const { data, total = 0 } = await fetch(`${API_URL}/parks?api_key=${API_KEY}&start=${result.length}`).then(res => res.json())
  const combined = [...result, ...data]
  if (combined.length < total) return await fetchParks(combined)

  await fs.writeFile(cacheFile, JSON.stringify(combined, null, 2))
  return combined
}

async function fetchPlaces(parkCode, result = []) {
  const cacheFile = `cache/places/${parkCode}.json`
  const cache = await fs.readFile(cacheFile).catch(err => 0)
  if (cache) return JSON.parse(cache.toString())

  const { data, total = 0 } = await fetch(`${API_URL}/places?api_key=${API_KEY}&start=${result.length}&parkCode=${parkCode}`).then(res => res.json())
  const combined = [...result, ...data]
  if (combined.length < total) return await fetchPlaces(parkCode, combined)

  await fs.writeFile(cacheFile, JSON.stringify(combined, null, 2))
  return combined
}