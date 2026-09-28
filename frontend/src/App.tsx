import { Routes, Route, useLocation, useParams, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { MarketProvider } from './contexts/MarketContext';
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
import AdminLayout from './pages/gerant/AdminLayout';
import DashboardPage from './pages/gerant/DashboardPage';
import ChambresPage from './pages/gerant/ChambresPage';
import ReservationsPage from './pages/gerant/ReservationsPage';
import AjouterChambre from './pages/gerant/AjouterChambre';
import PremiumPage from './pages/gerant/PremiumPage';
import PremiumSuccessPage from './pages/gerant/PremiumSuccessPage';
import ProfilPage from './pages/gerant/ProfilPage';
import VerificationPage from './pages/gerant/VerificationPage';
import GerantLogin from './pages/gerant/GerantLogin';
import OAuthCallback from './pages/gerant/OAuthCallback';
import GerantRouteGuard from './components/GerantRouteGuard';
import ClientRouteGuard from './components/ClientRouteGuard';
import ClientLogin from './pages/ClientLogin';
import RegisterRolePage from './pages/RegisterRolePage';
import ClientComptePage from './pages/ClientComptePage';
import AdminRouteGuard from './components/AdminRouteGuard';
import SuperAdminLayout from './pages/admin/SuperAdminLayout';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminChangePasswordPage from './pages/admin/AdminChangePasswordPage';
import AdminGerantsPage from './pages/admin/AdminGerantsPage';
import AdminBannersPage from './pages/admin/AdminBannersPage';
import AdminEventsPage from './pages/admin/AdminEventsPage';
import AdminReservationsPage from './pages/admin/AdminReservationsPage';
import AdminPromotionsPage from './pages/admin/AdminPromotionsPage';
import LandingPage from './pages/LandingPage';
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

  if (market !== 'ci' && market !== 'bj') {
    return <Navigate to="/" replace />;
  }

  return <MarketContent />;
}

function MarketContent() {
  const { pathname } = useLocation();
  const hideChrome =
    pathname.includes('/gerant') ||
    pathname.includes('/admin') ||
    pathname.includes('/login') ||
    pathname.includes('/inscription') ||
    pathname.includes('/sso-callback');
  return (
    <>
      {!hideChrome && <Header />}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/mentions-legales" element={<MentionsLegales />} />
        <Route path="/politique-de-confidentialite" element={<PolitiqueConfidentialite />} />
        <Route path="/chambre/:id" element={<RoomDetailPage />} />
        <Route path="/categorie/:id" element={<CategoryPage />} />
        <Route path="/recherche" element={<SearchResultsPage />} />
        <Route path="/suivi-reservation" element={<ClientReservationPage />} />
        <Route path="/compte" element={
          <ClientRouteGuard>
            <ClientComptePage />
          </ClientRouteGuard>
        } />

        <Route path="/login/gerant/*" element={<GerantLogin />} />
        <Route path="/login/*" element={<ClientLogin />} />
        <Route path="/inscription" element={<RegisterRolePage />} />
        <Route path="/inscription/client/*" element={<RegisterRolePage />} />
        <Route path="/inscription/gerant/*" element={<RegisterRolePage />} />
        <Route path="/sso-callback/*" element={<OAuthCallback />} />

        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={
          <AdminRouteGuard>
            <SuperAdminLayout />
          </AdminRouteGuard>
        }>
          <Route index element={<AdminDashboardPage />} />
          <Route path="reservations" element={<AdminReservationsPage />} />
          <Route path="mot-de-passe" element={<AdminChangePasswordPage />} />
          <Route path="gerants" element={<AdminGerantsPage />} />
          <Route path="banners" element={<AdminBannersPage />} />
          <Route path="evenements" element={<AdminEventsPage />} />
          <Route path="promotions" element={<AdminPromotionsPage />} />
        </Route>

        <Route path="/gerant" element={
          <GerantRouteGuard>
            <AdminLayout />
          </GerantRouteGuard>
        }>
          <Route index element={<DashboardPage />} />
          <Route path="chambres" element={<ChambresPage />} />
          <Route path="chambres/ajouter" element={<AjouterChambre />} />
          <Route path="reservations" element={<ReservationsPage />} />
          <Route path="premium" element={<PremiumPage />} />
          <Route path="premium/success" element={<PremiumSuccessPage />} />
          <Route path="verification" element={<VerificationPage />} />
          <Route path="verification/success" element={<VerificationPage />} />
          <Route path="profil" element={<ProfilPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {!hideChrome && <ClientNotificationBanner />}
      {!hideChrome && <Footer />}
      {!hideChrome && <BackToTop />}
    </>
  );
}

function RootRedirect() {
  return <LandingPage />;
}

function CatchAllRedirect() {
  return <Navigate to="/" replace />;
}

function AppRoutes() {
  const { pathname } = useLocation();
  return (
    <MarketProvider>
      <ScrollToTop />
      <ErrorBoundary key={pathname}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={
            <AdminRouteGuard>
              <SuperAdminLayout />
            </AdminRouteGuard>
          }>
            <Route index element={<AdminDashboardPage />} />
            <Route path="reservations" element={<AdminReservationsPage />} />
            <Route path="mot-de-passe" element={<AdminChangePasswordPage />} />
            <Route path="gerants" element={<AdminGerantsPage />} />
            <Route path="banners" element={<AdminBannersPage />} />
            <Route path="evenements" element={<AdminEventsPage />} />
            <Route path="promotions" element={<AdminPromotionsPage />} />
          </Route>
          <Route path="/:market/*" element={<MarketRoute />} />
          <Route path="*" element={<CatchAllRedirect />} />
        </Routes>
      </ErrorBoundary>
    </MarketProvider>
  );
}

export default function App() {
  return <AppRoutes />;
}
