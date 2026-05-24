export interface Coords {
  lat: number
  lng: number
}

/** Aktuelle Position als Promise. Wirft mit deutscher Fehlermeldung. */
export function getCurrentPosition(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Standortbestimmung wird von diesem Gerät nicht unterstützt.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error('Standort konnte nicht ermittelt werden. Bitte Berechtigung erteilen.')),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  })
}
