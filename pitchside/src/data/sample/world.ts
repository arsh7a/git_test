// Fictional leagues and clubs for the sample dataset.

export interface LeagueSeed {
  id: string
  name: string
  country: string
  nationCode: string
  /** Rough overall strength of the league, 0–1. */
  strength: number
  clubs: string[]
  stadiumWords: string[]
}

export const LEAGUE_SEEDS: LeagueSeed[] = [
  {
    id: 'premier-division',
    name: 'Premier Division',
    country: 'England',
    nationCode: 'ENG',
    strength: 0.78,
    clubs: [
      'Kingsmere City', 'Ashbury Rovers', 'Northgate United', 'Harlow Vale', 'Redcliffe Athletic',
      'Westbrook Albion', 'Thornbury Town', 'Calderford', 'Ironbridge Wanderers', 'Stonehaven County',
      'Millbrook Rangers', 'Eastport', 'Blackwater Forest', 'Granford City', 'Holloway Park',
      'Silverton Town', 'Marlow Heath', 'Castleford Vale',
    ],
    stadiumWords: ['Park', 'Road', 'Lane', 'Ground', 'Stadium'],
  },
  {
    id: 'primera-liga',
    name: 'Primera Liga',
    country: 'Spain',
    nationCode: 'ESP',
    strength: 0.74,
    clubs: [
      'Real Montalbán', 'CD Valdecruz', 'Atlético Sierra Alta', 'Deportivo Almira', 'CF Puerto Lucena',
      'Real Castellar', 'UD Tormes', 'SD Villanueva', 'Racing Marisol', 'CD Peñarroja',
      'Atlético Valdoro', 'Sporting Albarán', 'CF Riosol', 'Real Ostiva', 'UD Benalcázar',
      'CD Montealto', 'Club Arenales', 'UD Costa Serena',
    ],
    stadiumWords: ['Estadio', 'Campo', 'Nuevo Estadio'],
  },
  {
    id: 'erste-liga',
    name: 'Erste Liga',
    country: 'Germany',
    nationCode: 'GER',
    strength: 0.72,
    clubs: [
      'FC Rheinfeld', 'SV Altenburg', 'Borussia Kaltenbach', 'VfB Steinau', 'TSV Hollerbach',
      '1. FC Wendlingen', 'Eintracht Mühlheide', 'Fortuna Grünwald', 'SC Lindenau', 'VfL Brückenstadt',
      'Union Ostmark', 'SpVgg Hagenfels', 'Rot-Weiß Elsterau', 'FSV Bergheim', 'Viktoria Talburg',
      'Holstein Möwenhafen', 'Arminia Sandstedt', 'SV Wiesental',
    ],
    stadiumWords: ['Arena', 'Stadion', 'Park'],
  },
  {
    id: 'serie-nazionale',
    name: 'Serie Nazionale',
    country: 'Italy',
    nationCode: 'ITA',
    strength: 0.71,
    clubs: [
      'AC Valtorre', 'US Montecastello', 'Calcio Brentano', 'US Valmarino', 'AS Fiorenzuola Nuova',
      'Pro Castelverde', 'SS Lazzaretto', 'FC Montebianco', 'Virtus Santoro', 'AC Riva Lunga',
      'Unione Sanvito', 'Calcio Portoferro', 'AS Collina d\'Oro', 'US Torrevecchia', 'FC Arcobaleno',
      'Polisportiva Aurelia', 'Atletico Vallombrosa', 'AC Monterosso',
    ],
    stadiumWords: ['Stadio', 'Stadio Comunale'],
  },
  {
    id: 'division-elite',
    name: 'Division Élite',
    country: 'France',
    nationCode: 'FRA',
    strength: 0.68,
    clubs: [
      'Olympique Mirebeau', 'AS Saint-Clair', 'FC Valmont', 'Stade Lumière', 'RC Côte d\'Argent',
      'US Montferrand', 'SC Beaurivage', 'En Avant Kerlouan', 'Racing Belleville', 'Stade Arverne',
      'AC Pontmartin', 'FC Rochebrune', 'Olympique Sainte-Aude', 'AS Clairvaux', 'Union Vauclair',
      'FC Lanvallon', 'Stade Marivent', 'AS Bellegarde',
    ],
    stadiumWords: ['Stade', 'Parc'],
  },
]

/** Pairs of club colours: [primary, secondary]. */
export const CLUB_COLORS: [string, string][] = [
  ['#c8102e', '#ffffff'], ['#0b3d91', '#ffffff'], ['#1b1b1b', '#f2c200'], ['#5a1e5e', '#9ad3f0'],
  ['#006241', '#ffffff'], ['#e35205', '#1b1b1b'], ['#7a003c', '#e3b23c'], ['#00a3e0', '#0b2341'],
  ['#ffffff', '#1d1d1b'], ['#f2c200', '#0b3d91'], ['#8b0000', '#87ceeb'], ['#2e7d32', '#f2c200'],
  ['#1d1d1b', '#ffffff'], ['#d71920', '#000000'], ['#6cace4', '#ffffff'], ['#003087', '#c8102e'],
  ['#4b0082', '#ffffff'], ['#a6192e', '#f1be48'],
]
