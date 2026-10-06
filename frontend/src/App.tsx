import { Routes, Route, useLocation, useParams, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { MarketProvider } from './contexts/MarketContext';
import { isMarketSlug } from './config/markets';
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
import NotFoundPage from './pages/NotFoundPage';
import ClientNotificationBanner from './components/ClientNotificationBanner';
import OfflineBanner from './components/OfflineBanner';
import RoleRouteGuard from './components/RoleRouteGuard';
import AdminRouteGuard from './components/AdminRouteGuard';
import LandingPage from './pages/LandingPage';
import { useRevealOnScroll } from './hooks/useRevealOnScroll';

// Routes hors accueil : chargées à la demande pour ne pas embarquer Leaflet,
// le back-office et l'espace gérant dans le premier chunk de la home.
const MentionsLegales = lazy(() => import('./pages/MentionsLegales'));
const PolitiqueConfidentialite = lazy(() => import('./pages/PolitiqueConfidentialite'));
const AProposPage = lazy(() => import('./pages/AProposPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const RoomDetailPage = lazy(() => import('./pages/RoomDetailPage'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const SearchResultsPage = lazy(() => import('./pages/SearchResultsPage'));
const ClientReservationPage = lazy(() => import('./pages/ClientReservationPage'));
const ClientComptePage = lazy(() => import('./pages/ClientComptePage'));
const ClientLogin = lazy(() => import('./pages/ClientLogin'));
const RegisterRolePage = lazy(() => import('./pages/RegisterRolePage'));

const AdminLayout = lazy(() => import('./pages/gerant/AdminLayout'));
const DashboardPage = lazy(() => import('./pages/gerant/DashboardPage'));
const ChambresPage = lazy(() => import('./pages/gerant/ChambresPage'));
const ReservationsPage = lazy(() => import('./pages/gerant/ReservationsPage'));
const AjouterChambre = lazy(() => import('./pages/gerant/AjouterChambre'));
const PremiumPage = lazy(() => import('./pages/gerant/PremiumPage'));
const PremiumSuccessPage = lazy(() => import('./pages/gerant/PremiumSuccessPage'));
const BoostsPage = lazy(() => import('./pages/gerant/BoostsPage'));
const BoostCreatePage = lazy(() => import('./pages/gerant/BoostCreatePage'));
const BoostSuccessPage = lazy(() => import('./pages/gerant/BoostSuccessPage'));
const ProfilPage = lazy(() => import('./pages/gerant/ProfilPage'));
const VerificationPage = lazy(() => import('./pages/gerant/VerificationPage'));
const GerantLogin = lazy(() => import('./pages/gerant/GerantLogin'));
const OAuthCallback = lazy(() => import('./pages/gerant/OAuthCallback'));

const SuperAdminLayout = lazy(() => import('./pages/admin/SuperAdminLayout'));
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminChangePasswordPage = lazy(() => import('./pages/admin/AdminChangePasswordPage'));
const AdminGerantsPage = lazy(() => import('./pages/admin/AdminGerantsPage'));
const AdminBannersPage = lazy(() => import('./pages/admin/AdminBannersPage'));
const AdminEventsPage = lazy(() => import('./pages/admin/AdminEventsPage'));
const AdminDestinationsPage = lazy(() => import('./pages/admin/AdminDestinationsPage'));
const AdminReservationsPage = lazy(() => import('./pages/admin/AdminReservationsPage'));
const AdminPromotionsPage = lazy(() => import('./pages/admin/AdminPromotionsPage'));
const AdminBoostsPage = lazy(() => import('./pages/admin/AdminBoostsPage'));

function RouteFallback() {
  return (
    <div className="route-loading">
      <div className="auth-loading__spinner" />
      <p>Chargement...</p>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// Arborescence back-office déclarée une seule fois : elle est montée à la fois
// depuis les routes de marché et depuis les routes racine, sinon les définitions
// divergent à chaque ajout de page admin.
const adminSectionRoutes = (
  <>
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
      <Route path="destinations" element={<AdminDestinationsPage />} />
      <Route path="promotions" element={<AdminPromotionsPage />} />
      <Route path="boosts" element={<AdminBoostsPage />} />
    </Route>
  </>
);

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

  if (!isMarketSlug(market)) {
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
      <OfflineBanner />
      {!hideChrome && <Header />}
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
        <Route path="/mentions-legales" element={<MentionsLegales />} />
        <Route path="/politique-de-confidentialite" element={<PolitiqueConfidentialite />} />
        <Route path="/a-propos" element={<Navigate to="/a-propos" replace />} />
        <Route path="/contact" element={<Navigate to="/contact" replace />} />
        <Route path="/chambre/:id" element={<RoomDetailPage />} />
        <Route path="/categorie/:id" element={<CategoryPage />} />
        <Route path="/recherche" element={<SearchResultsPage />} />
        <Route path="/suivi-reservation" element={<ClientReservationPage />} />
        <Route path="/compte" element={
          <RoleRouteGuard role="client">
            <ClientComptePage />
          </RoleRouteGuard>
        } />

        <Route path="/login/gerant/*" element={<GerantLogin />} />
        <Route path="/login/*" element={<ClientLogin />} />
        <Route path="/inscription" element={<RegisterRolePage />} />
        <Route path="/inscription/client/*" element={<RegisterRolePage />} />
        <Route path="/inscription/gerant/*" element={<RegisterRolePage />} />
        <Route path="/sso-callback/*" element={<OAuthCallback />} />

        {adminSectionRoutes}

        <Route path="/gerant" element={
          <RoleRouteGuard role="gerant">
            <AdminLayout />
          </RoleRouteGuard>
        }>
          <Route index element={<DashboardPage />} />
          <Route path="chambres" element={<ChambresPage />} />
          <Route path="chambres/ajouter" element={<AjouterChambre />} />
          <Route path="reservations" element={<ReservationsPage />} />
          <Route path="premium" element={<PremiumPage />} />
          <Route path="premium/success" element={<PremiumSuccessPage />} />
          <Route path="boosts" element={<BoostsPage />} />
          <Route path="boosts/new" element={<BoostCreatePage />} />
          <Route path="boosts/success" element={<BoostSuccessPage />} />
          <Route path="verification" element={<VerificationPage />} />
          <Route path="profil" element={<ProfilPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      {!hideChrome && <ClientNotificationBanner />}
      {!hideChrome && <Footer />}
      {!hideChrome && <BackToTop />}
    </>
  );
}

// Chrome du site (bandeau, en-tête, notifications, pied de page, retour haut)
// partagé par l'accueil racine et les pages de contenu servies hors marché.
function SiteChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <OfflineBanner />
      <Header />
      {children}
      <ClientNotificationBanner />
      <Footer />
      <BackToTop />
    </>
  );
}

// Page d'accueil racine : squelette CoinAfrique (hero + recherche, choix du
// pays, carrousel, témoignages) enveloppé du chrome du site.
function RootRedirect() {
  return <SiteChrome><LandingPage /></SiteChrome>;
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
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/a-propos" element={<SiteChrome><AProposPage /></SiteChrome>} />
            <Route path="/contact" element={<SiteChrome><ContactPage /></SiteChrome>} />
            {adminSectionRoutes}
            <Route path="/:market/*" element={<MarketRoute />} />
            <Route path="*" element={<CatchAllRedirect />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </MarketProvider>
  );
}

export default function App() {
  return <AppRoutes />;
}
