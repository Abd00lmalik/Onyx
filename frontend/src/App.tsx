import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Header } from './components/layout/Header'
import { Footer } from './components/layout/Footer'
import { HomePage } from './pages/HomePage'
import { BrowsePage } from './pages/BrowsePage'
import { ListPage } from './pages/ListPage'
import { ListingDetailPage } from './pages/ListingDetailPage'
import { DashboardPage } from './pages/DashboardPage'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-cream">
        <Header />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/browse" element={<BrowsePage />} />
            <Route path="/list" element={<ListPage />} />
            <Route path="/listing/:id" element={<ListingDetailPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  )
}

export default App
