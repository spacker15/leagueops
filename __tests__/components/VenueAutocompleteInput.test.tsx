import { describe, it } from 'vitest'

describe('VenueAutocompleteInput', () => {
  // EVT-01: Admin can search for a venue via Google Maps autocomplete
  it.todo('calls /api/maps/autocomplete when input >= 3 chars')
  it.todo('does NOT call API when input < 3 chars')
  it.todo('renders dropdown with predictions from API response')
  it.todo('debounces API calls (300ms)')

  // EVT-02: Venue lat/lng/address/place_id saved on selection
  it.todo('calls /api/maps/details on prediction selection')
  it.todo('calls onVenueSelect with name, address, lat, lng, place_id')
  it.todo('calls onLocationChange on every keystroke (freetext fallback)')
  it.todo('shows "Venue saved" chip when selectedPlaceId is truthy')
})
