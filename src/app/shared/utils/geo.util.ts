const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance in metres between two points (haversine). The server re-checks it; this is for showing the student. */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return Math.round(EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/** "42 m" or "1.2 km". */
export function formatDistance(meters: number): string {
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1)} km`;
}

export interface Position { lat: number; lng: number; accuracy: number }

/** The device's position, or a rejection with a message a student can act on. */
export function currentPosition(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('This browser cannot provide your location.'));
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      e => reject(new Error(e.code === e.PERMISSION_DENIED ? 'Location access was blocked. Allow it for this site in your browser settings and try again.' : 'Could not get your location. Move to an open area and try again.')),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );
  });
}
