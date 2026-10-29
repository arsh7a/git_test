import type { Nation } from '../types'

// Nations with simplified flags and pools of common first/last names.
// Names are combined at random, so every sample player is fictional.

export interface NationPool extends Nation {
  first: string[]
  last: string[]
}

export const NATIONS: NationPool[] = [
  {
    code: 'ENG', name: 'England', flag: { kind: 'stgeorge', bg: '#ffffff', cross: '#ce1124' },
    first: ['Jack', 'Harry', 'Oliver', 'George', 'Callum', 'Ryan', 'Lewis', 'Ben', 'Jamie', 'Tom', 'Kieran', 'Alfie', 'Mason', 'Reece', 'Owen', 'Elliot', 'Joe', 'Luke'],
    last: ['Ashworth', 'Bramley', 'Caldwell', 'Denholm', 'Fairclough', 'Garside', 'Hartley', 'Ingram', 'Kershaw', 'Lomax', 'Marsden', 'Norbury', 'Pickering', 'Radcliffe', 'Sutcliffe', 'Thornton', 'Whitlock', 'Yardley', 'Brindley', 'Cobb', 'Harlow', 'Pennock'],
  },
  {
    code: 'ESP', name: 'Spain', flag: { kind: 'h', colors: ['#aa151b', '#f1bf00', '#aa151b'], weights: [1, 2, 1] },
    first: ['Álvaro', 'Pablo', 'Sergio', 'Iker', 'Javier', 'Adrián', 'Marcos', 'Unai', 'Rubén', 'Hugo', 'Diego', 'Raúl', 'Óscar', 'Mikel', 'Aitor', 'Íñigo'],
    last: ['Albarrán', 'Bermejo', 'Cuadrado', 'Escribano', 'Galindo', 'Iturralde', 'Lozano', 'Mediavilla', 'Navarrete', 'Olmedo', 'Peralta', 'Quintana', 'Robledo', 'Saldaña', 'Toribio', 'Valcárcel', 'Zubeldía', 'Arteaga'],
  },
  {
    code: 'GER', name: 'Germany', flag: { kind: 'h', colors: ['#000000', '#dd0000', '#ffce00'] },
    first: ['Lukas', 'Jonas', 'Felix', 'Niklas', 'Leon', 'Maximilian', 'Tim', 'Florian', 'Jannik', 'Moritz', 'Julian', 'Tobias', 'Paul', 'Fabian', 'Lennart'],
    last: ['Albrecht', 'Brandt', 'Eberhardt', 'Falkenberg', 'Gerlach', 'Hellwig', 'Kessler', 'Lindner', 'Matthes', 'Oberle', 'Reinholz', 'Schaller', 'Thielmann', 'Vogelsang', 'Wendler', 'Ziegler', 'Brückner', 'Hartwig'],
  },
  {
    code: 'ITA', name: 'Italy', flag: { kind: 'v', colors: ['#009246', '#ffffff', '#ce2b37'] },
    first: ['Lorenzo', 'Matteo', 'Alessandro', 'Federico', 'Davide', 'Riccardo', 'Gianluca', 'Nicolò', 'Simone', 'Tommaso', 'Andrea', 'Stefano', 'Michele', 'Filippo'],
    last: ['Bellandi', 'Caruso', 'D\'Amico', 'Ferraresi', 'Galeotti', 'Lombardo', 'Mancuso', 'Orsini', 'Pellegrino', 'Rinaldi', 'Santoro', 'Tedeschi', 'Valentini', 'Zanetti', 'Bertolini', 'Cavalli'],
  },
  {
    code: 'FRA', name: 'France', flag: { kind: 'v', colors: ['#002395', '#ffffff', '#ed2939'] },
    first: ['Théo', 'Lucas', 'Hugo', 'Maxime', 'Antoine', 'Mathis', 'Enzo', 'Baptiste', 'Clément', 'Yanis', 'Rayan', 'Quentin', 'Adrien', 'Nathan', 'Romain'],
    last: ['Arnaud', 'Barreau', 'Chevallier', 'Delorme', 'Fontaine', 'Gauthier', 'Lacombe', 'Marchand', 'Navarro', 'Perrin', 'Rousseau', 'Tessier', 'Vasseur', 'Lemoine', 'Brochard', 'Guérin'],
  },
  {
    code: 'NED', name: 'Netherlands', flag: { kind: 'h', colors: ['#ae1c28', '#ffffff', '#21468b'] },
    first: ['Daan', 'Sem', 'Thijs', 'Jesse', 'Bram', 'Luuk', 'Stijn', 'Ruben', 'Joris', 'Milan'],
    last: ['van Dalen', 'de Graaf', 'Hoekstra', 'Kuipers', 'Meijer', 'van Rijn', 'Smeets', 'Verhoef', 'Wouters', 'Brouwer', 'de Lange', 'Postma'],
  },
  {
    code: 'POR', name: 'Portugal', flag: { kind: 'v', colors: ['#006600', '#ff0000'], weights: [2, 3] },
    first: ['João', 'Rúben', 'Tiago', 'Gonçalo', 'Diogo', 'Rafael', 'Nuno', 'Vitor', 'André', 'Miguel'],
    last: ['Amaral', 'Barros', 'Carvalhal', 'Esteves', 'Figueira', 'Lacerda', 'Moutinho', 'Paiva', 'Quaresma', 'Sequeira', 'Teixeira', 'Vilela'],
  },
  {
    code: 'BEL', name: 'Belgium', flag: { kind: 'v', colors: ['#000000', '#fdda24', '#ef3340'] },
    first: ['Arthur', 'Louis', 'Wout', 'Jarne', 'Senne', 'Noah', 'Victor', 'Mats'],
    last: ['Claessens', 'Dewaele', 'Goossens', 'Janssens', 'Maes', 'Peeters', 'Verstraete', 'Willems', 'Lambrecht', 'Hendrickx'],
  },
  {
    code: 'BRA', name: 'Brazil', flag: { kind: 'diamond', bg: '#009c3b', diamond: '#ffdf00', disc: '#002776' },
    first: ['Gabriel', 'Matheus', 'Lucas', 'Rodrigo', 'Thiago', 'Vinícius', 'Caio', 'Felipe', 'Igor', 'Renan', 'Douglas', 'Wesley'],
    last: ['Almeida', 'Bastos', 'Campos', 'Dantas', 'Freitas', 'Guimarães', 'Leite', 'Machado', 'Nogueira', 'Rezende', 'Siqueira', 'Toledo'],
  },
  {
    code: 'ARG', name: 'Argentina', flag: { kind: 'h', colors: ['#74acdf', '#ffffff', '#74acdf'] },
    first: ['Facundo', 'Nicolás', 'Lautaro', 'Gonzalo', 'Matías', 'Ezequiel', 'Franco', 'Joaquín', 'Tomás', 'Agustín'],
    last: ['Acosta', 'Benítez', 'Cabral', 'Domínguez', 'Ferreyra', 'Godoy', 'Ledesma', 'Medina', 'Ojeda', 'Paredes', 'Quiroga', 'Sosa'],
  },
  {
    code: 'SEN', name: 'Senegal', flag: { kind: 'v', colors: ['#00853f', '#fdef42', '#e31b23'] },
    first: ['Moussa', 'Cheikh', 'Pape', 'Ibrahima', 'Abdou', 'Lamine', 'Ousmane', 'Mamadou'],
    last: ['Ba', 'Ciss', 'Diatta', 'Faye', 'Gueye', 'Kane', 'Ndiaye', 'Sarr', 'Thiam', 'Seck'],
  },
  {
    code: 'NGA', name: 'Nigeria', flag: { kind: 'v', colors: ['#008751', '#ffffff', '#008751'] },
    first: ['Chidi', 'Emeka', 'Tobi', 'Samuel', 'Victor', 'Kelechi', 'Femi', 'Ademola'],
    last: ['Adeyemi', 'Balogun', 'Chukwu', 'Eze', 'Nwankwo', 'Okafor', 'Olawale', 'Uche', 'Obi', 'Akande'],
  },
  {
    code: 'CIV', name: 'Côte d\'Ivoire', flag: { kind: 'v', colors: ['#f77f00', '#ffffff', '#009e60'] },
    first: ['Yao', 'Serge', 'Wilfried', 'Jean-Philippe', 'Koffi', 'Hamed'],
    last: ['Bamba', 'Coulibaly', 'Diomandé', 'Kouamé', 'Ouattara', 'Traoré', 'Zoro', 'Konan'],
  },
  {
    code: 'DEN', name: 'Denmark', flag: { kind: 'nordic', bg: '#c8102e', cross: '#ffffff' },
    first: ['Mads', 'Rasmus', 'Mikkel', 'Andreas', 'Frederik', 'Oliver', 'Magnus'],
    last: ['Bendtsen', 'Dalsgaard', 'Holm', 'Kjeldsen', 'Lauridsen', 'Nørgaard', 'Skov', 'Vestergaard'],
  },
  {
    code: 'SWE', name: 'Sweden', flag: { kind: 'nordic', bg: '#006aa7', cross: '#fecc00' },
    first: ['Erik', 'Viktor', 'Oscar', 'Emil', 'Hampus', 'Linus'],
    last: ['Berglund', 'Ekdahl', 'Holmqvist', 'Lindgren', 'Nyström', 'Sjöberg', 'Wallin'],
  },
  {
    code: 'NOR', name: 'Norway', flag: { kind: 'nordic', bg: '#ba0c2f', cross: '#ffffff', inner: '#00205b' },
    first: ['Sander', 'Henrik', 'Jørgen', 'Eirik', 'Kristoffer'],
    last: ['Aasen', 'Bakke', 'Haugland', 'Lunde', 'Solberg', 'Tveit'],
  },
  {
    code: 'CRO', name: 'Croatia', flag: { kind: 'h', colors: ['#ff0000', '#ffffff', '#171796'] },
    first: ['Luka', 'Ivan', 'Marko', 'Ante', 'Josip', 'Mario'],
    last: ['Babić', 'Horvat', 'Jurić', 'Kovačević', 'Marić', 'Pavlović', 'Šimić'],
  },
  {
    code: 'POL', name: 'Poland', flag: { kind: 'h', colors: ['#ffffff', '#dc143c'] },
    first: ['Jakub', 'Kacper', 'Bartosz', 'Mateusz', 'Szymon'],
    last: ['Kowalczyk', 'Mazur', 'Nowicki', 'Wróbel', 'Zając', 'Sikora'],
  },
  {
    code: 'JPN', name: 'Japan', flag: { kind: 'disc', bg: '#ffffff', disc: '#bc002d' },
    first: ['Haruto', 'Ren', 'Sota', 'Yuto', 'Daichi', 'Kaito'],
    last: ['Fujita', 'Ishikawa', 'Kobayashi', 'Matsuda', 'Nakamura', 'Ogawa', 'Sakamoto'],
  },
  {
    code: 'COL', name: 'Colombia', flag: { kind: 'h', colors: ['#fcd116', '#003893', '#ce1126'], weights: [2, 1, 1] },
    first: ['Juan', 'Santiago', 'Andrés', 'Camilo', 'Sebastián'],
    last: ['Arango', 'Cardona', 'Gutiérrez', 'Montoya', 'Restrepo', 'Valencia'],
  },
  {
    code: 'IRL', name: 'Ireland', flag: { kind: 'v', colors: ['#169b62', '#ffffff', '#ff883e'] },
    first: ['Seán', 'Conor', 'Cian', 'Darragh', 'Niall'],
    last: ['Brennan', 'Doherty', 'Keane', 'Moran', 'Nolan', 'Ryan'],
  },
  {
    code: 'AUT', name: 'Austria', flag: { kind: 'h', colors: ['#ed2939', '#ffffff', '#ed2939'] },
    first: ['Stefan', 'Konrad', 'Valentin', 'Raphael', 'Philipp'],
    last: ['Aigner', 'Gruber', 'Huber', 'Pichler', 'Steiner', 'Wimmer'],
  },
  {
    code: 'UKR', name: 'Ukraine', flag: { kind: 'h', colors: ['#0057b7', '#ffd700'] },
    first: ['Oleksandr', 'Mykola', 'Artem', 'Bohdan', 'Dmytro'],
    last: ['Bondarenko', 'Hrytsenko', 'Kovalenko', 'Melnyk', 'Shevchuk', 'Tkachenko'],
  },
]

export const NATION_BY_CODE = new Map(NATIONS.map((n) => [n.code, n]))
