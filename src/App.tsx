import { BrowserRouter, Routes, Route, useLocation, useParams, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { MarketProvider, useMarket, type MarketCode } from './contexts/MarketContext';
import Header from './components/Header';
import Hero from './components/Hero';
import PopularSection from './components/PopularSection';
import PromosSection from './components/PromosSection';
import CategoriesSection from './components/CategoriesSection';
import EventsSection from './components/EventsSection';
import TourismSection from './components/TourismSection';
import EscapadeSection from './components/EscapadeSection';
import ReviewsSection from './components/ReviewsSection';
import Footer from './components/Footer';
import BackToTop from './components/BackToTop';
import ErrorBoundary from './components/ErrorBoundary';
import MentionsLegales from './pages/MentionsLegales';
import PolitiqueConfidentialite from './pages/PolitiqueConfidentialite';
import RoomDetailPage from './pages/RoomDetailPage';
import CategoryPage from './pages/CategoryPage';
import SearchResultsPage from './pages/SearchResultsPage';
import NotFoundPage from './pages/NotFoundPage';
import ClientReservationPage from './pages/ClientReservationPage';
import ClientNotificationBanner from './components/ClientNotificationBanner';
import AdminLayout from './pages/admin/AdminLayout';
import DashboardPage from './pages/admin/DashboardPage';
import ChambresPage from './pages/admin/ChambresPage';
import CategoriesPage from './pages/admin/CategoriesPage';
import BannieresPage from './pages/admin/BannieresPage';
import ReservationsPage from './pages/admin/ReservationsPage';
import AjouterChambre from './pages/admin/AjouterChambre';
import { useRevealOnScroll } from './hooks/useRevealOnScroll';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function HomePage() {
  useRevealOnScroll();
  return (
    <main>
      <Hero />
      <PopularSection />
      <PromosSection />
      <CategoriesSection />
      <EventsSection />
      <TourismSection />
      <EscapadeSection />
      <ReviewsSection />
    </main>
  );
}

function MarketRoute() {
  const { market } = useParams<{ market: string }>();
  const { setMarket } = useMarket();

  useEffect(() => {
    if (market === 'ci' || market === 'bj') {
      setMarket(market.toUpperCase() as MarketCode);
    }
  }, [market, setMarket]);

  return <MarketContent />;
}

function MarketContent() {
  const { pathname } = useLocation();
  const isAdmin = pathname.includes('/admin');
  return (
    <>
      {!isAdmin && <Header />}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/mentions-legales" element={<MentionsLegales />} />
        <Route path="/politique-de-confidentialite" element={<PolitiqueConfidentialite />} />
        <Route path="/chambre/:id" element={<RoomDetailPage />} />
        <Route path="/categorie/:id" element={<CategoryPage />} />
        <Route path="/recherche" element={<SearchResultsPage />} />
        <Route path="/suivi-reservation" element={<ClientReservationPage />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="chambres" element={<ChambresPage />} />
          <Route path="chambres/ajouter" element={<AjouterChambre />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="bannieres" element={<BannieresPage />} />
          <Route path="reservations" element={<ReservationsPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {!isAdmin && <ClientNotificationBanner />}
      {!isAdmin && <Footer />}
      {!isAdmin && <BackToTop />}
    </>
  );
}

function RootRedirect() {
  const { market } = useMarket();
  return <Navigate to={`/${market.toLowerCase()}`} replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <MarketProvider>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/:market/*" element={<MarketRoute />} />
            <Route path="*" element={<Navigate to="/ci" replace />} />
          </Routes>
        </MarketProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
