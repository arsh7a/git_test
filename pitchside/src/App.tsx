import { HashRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Compare } from './pages/Compare'
import { Home } from './pages/Home'
import { LeagueDetail, Leagues } from './pages/Leagues'
import { NotFound } from './pages/NotFound'
import { PlayerProfile } from './pages/PlayerProfile'
import { Players } from './pages/Players'
import { Stats } from './pages/Stats'

// The site's pages and their web addresses.
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="players" element={<Players />} />
          <Route path="players/:id" element={<PlayerProfile />} />
          <Route path="players/:id/:tab" element={<PlayerProfile />} />
          <Route path="compare" element={<Compare />} />
          <Route path="stats" element={<Stats />} />
          <Route path="leagues" element={<Leagues />} />
          <Route path="leagues/:id" element={<LeagueDetail />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
