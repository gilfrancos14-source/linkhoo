import { Routes, Route, useLocation, useParams, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { MarketProvider, useMarket } from './contexts/MarketContext';
import { FavoritesProvider } from './contexts/FavoritesContext';
import { isMarketSlug, MARKETS } from './config/markets';
import Header from './components/Header';
import Footer from './components/Footer';
import BackToTop from './components/BackToTop';
import ErrorBoundary from './components/ErrorBoundary';
import NotFoundPage from './pages/NotFoundPage';
import ClientNotificationBanner from './components/ClientNotificationBanner';
import OfflineBanner from './components/OfflineBanner';
import RoleRouteGuard from './components/RoleRouteGuard';
import AdminRouteGuard from './components/AdminRouteGuard';
import LandingPage from './pages/LandingPage';
import MaquettePage from './pages/MaquettePage';

// Routes hors accueil : chargées à la demande pour ne pas embarquer Leaflet,
// le back-office et l'espace gérant dans le premier chunk de la home.
const MentionsLegales = lazy(() => import('./pages/MentionsLegales'));
const PolitiqueConfidentialite = lazy(() => import('./pages/PolitiqueConfidentialite'));
const AProposPage = lazy(() => import('./pages/AProposPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const RoomDetailMaq7 = lazy(() => import('./pages/RoomDetailMaq7'));
const SearchResultsPage = lazy(() => import('./pages/SearchResultsPage'));
const ClientReservationPage = lazy(() => import('./pages/ClientReservationPage'));
const ReservationPaymentPage = lazy(() => import('./pages/ReservationPaymentPage'));
const ClientComptePage = lazy(() => import('./pages/ClientComptePage'));
const ClientMessagesPage = lazy(() => import('./pages/messages/ClientMessagesPage'));
const LaisserAvisPage = lazy(() => import('./pages/LaisserAvisPage'));
const ClientLogin = lazy(() => import('./pages/ClientLogin'));
const RegisterRolePage = lazy(() => import('./pages/RegisterRolePage'));

const AdminLayout = lazy(() => import('./pages/gerant/AdminLayout'));
const DashboardPage = lazy(() => import('./pages/gerant/DashboardPage'));
const ChambresPage = lazy(() => import('./pages/gerant/ChambresPage'));
const ReservationsPage = lazy(() => import('./pages/gerant/ReservationsPage'));
const AjouterChambre = lazy(() => import('./pages/gerant/AjouterChambreMaq3'));
const DemandesReservationMaq4 = lazy(() => import('./pages/gerant/DemandesReservationMaq4'));
const PremiumPage = lazy(() => import('./pages/gerant/PremiumPage'));
const PremiumSuccessPage = lazy(() => import('./pages/gerant/PremiumSuccessPage'));
const MesInformationsMaq = lazy(() => import('./pages/gerant/MesInformationsMaq'));
const VerificationPage = lazy(() => import('./pages/gerant/VerificationPage'));
const SuiviVerificationPage = lazy(() => import('./pages/gerant/SuiviVerificationPage'));
const GerantLogin = lazy(() => import('./pages/gerant/GerantLogin'));
const OAuthCallback = lazy(() => import('./pages/gerant/OAuthCallback'));
const CalendrierMaq5 = lazy(() => import('./pages/gerant/CalendrierMaq5'));
const BoiteReceptionMaq6 = lazy(() => import('./pages/gerant/BoiteReceptionMaq6'));
const ReversementsPage = lazy(() => import('./pages/gerant/ReversementsPage'));

const SuperAdminLayout = lazy(() => import('./pages/admin/SuperAdminLayout'));
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminChangePasswordPage = lazy(() => import('./pages/admin/AdminChangePasswordPage'));
const AdminGerantsPage = lazy(() => import('./pages/admin/AdminGerantsPage'));
const AdminBannersPage = lazy(() => import('./pages/admin/AdminBannersPage'));
const AdminEventsPage = lazy(() => import('./pages/admin/AdminEventsPage'));
const AdminDestinationsPage = lazy(() => import('./pages/admin/AdminDestinationsPage'));
const AdminEscapadesPage = lazy(() => import('./pages/admin/AdminEscapadesPage'));
const AdminReservationsPage = lazy(() => import('./pages/admin/AdminReservationsPage'));
const AdminPromotionsPage = lazy(() => import('./pages/admin/AdminPromotionsPage'));
const AdminEquipePage = lazy(() => import('./pages/admin/AdminEquipePage'));

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
      <Route path="escapades" element={<AdminEscapadesPage />} />
      <Route path="promotions" element={<AdminPromotionsPage />} />
      <Route path="equipe" element={<AdminEquipePage />} />
    </Route>
  </>
);

function MarketRoute() {
  const { market } = useParams<{ market: string }>();

  if (!isMarketSlug(market)) {
    return <Navigate to="/" replace />;
  }

  return <MarketContent />;
}

function MarketContent() {
  const { pathname } = useLocation();
  const { market } = useMarket();
  // Accueil du marché : la maquette statique remplace le contenu React.
  // Elle est identique pour tous les marchés — seules les données de l'API changent.
  const marketHome = `/${market.toLowerCase()}`;
  const isMaquetteHome =
    pathname === marketHome || pathname === `${marketHome}/`;
  // Espace client (/compte, /messages) : la page porte sa propre sidebar et
  // occupe toute la hauteur → aucun chrome du site (en-tête, pied, bannière).
  const isClientSpace = /\/compte(\/|$)/.test(pathname) || /\/messages(\/|$)/.test(pathname) || /\/avis(\/|$)/.test(pathname);
  // La recherche porte le footer éditorial de la page d'accueil.
  const isSearchPage = /\/recherche(\/|$)/.test(pathname);
  // La fiche chambre reproduit la maquette HabiCI : elle embarque son propre
  // en-tête, son pied de page et sa navigation mobile.
  const isRoomDetail = /\/chambre(\/|$)/.test(pathname);
  // Retour de checkout : page autonome de confirmation, sans chrome du site.
  const isPaymentReturn = /\/reservation\/paiement(\/|$)/.test(pathname);
  const hideChrome =
    isMaquetteHome ||
    isRoomDetail ||
    isPaymentReturn ||
    isClientSpace ||
    pathname.includes('/gerant') ||
    pathname.includes('/admin') ||
    pathname.includes('/login') ||
    pathname.includes('/inscription') ||
    pathname.includes('/sso-callback');
  return (
    <>
      {!isMaquetteHome && !isRoomDetail && <OfflineBanner />}
      {!hideChrome && !isSearchPage && <Header />}
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<MaquettePage />} />
        <Route path="/mentions-legales" element={<MentionsLegales />} />
        <Route path="/politique-de-confidentialite" element={<PolitiqueConfidentialite />} />
        <Route path="/a-propos" element={<Navigate to="/a-propos" replace />} />
        <Route path="/contact" element={<Navigate to="/contact" replace />} />
        <Route path="/chambre/:id" element={<RoomDetailMaq7 />} />
        <Route path="/recherche" element={<SearchResultsPage />} />
        <Route path="/suivi-reservation" element={<ClientReservationPage />} />
        <Route path="/reservation/paiement" element={<ReservationPaymentPage />} />
        <Route path="/compte" element={
          <RoleRouteGuard role="client">
            <ClientComptePage />
          </RoleRouteGuard>
        } />
        <Route path="/messages" element={
          <RoleRouteGuard role="client">
            <ClientMessagesPage />
          </RoleRouteGuard>
        } />
        <Route path="/messages/:conversationId" element={
          <RoleRouteGuard role="client">
            <ClientMessagesPage />
          </RoleRouteGuard>
        } />
        <Route path="/avis/:reservationId" element={
          <RoleRouteGuard role="client">
            <LaisserAvisPage />
          </RoleRouteGuard>
        } />
        <Route path="/avis/:reservationId" element={
          <RoleRouteGuard role="client">
            <LaisserAvisPage />
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
          <Route path="reservations/demandes" element={<DemandesReservationMaq4 />} />
          <Route path="reservations/calendrier" element={<CalendrierMaq5 />} />
          <Route path="reversements" element={<ReversementsPage />} />
          <Route path="premium" element={<PremiumPage />} />
          <Route path="premium/success" element={<PremiumSuccessPage />} />
          <Route path="verification" element={<VerificationPage />} />
          <Route path="verification/suivi" element={<SuiviVerificationPage />} />
          <Route path="messages/boite-reception" element={<BoiteReceptionMaq6 />} />
          <Route path="profil" element={<MesInformationsMaq />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      {!hideChrome && <ClientNotificationBanner />}
      {!hideChrome && !isSearchPage && <Footer />}
      {!hideChrome && <BackToTop />}
    </>
  );
}

// Page d'accueil racine : la maquette d'accueil est reproduite à
// l'identique (header, bandeau, sections et footer inclus dans le fragment),
// donc aucun chrome du site n'est ajouté par-dessus.
function RootRedirect() {
  return <LandingPage />;
}

function CatchAllRedirect() {
  return <Navigate to="/" replace />;
}

/**
 * Les liens de fiche chambre circulent parfois sans préfixe de marché
 * (`/chambre/<id>` : anciens liens, partages, saisie manuelle). Sans cette
 * route, l'URL tombait dans `*` et renvoyait sur la page d'accueil — la fiche
 * semblait donc « ne pas s'afficher ». On la redirige vers le marché par
 * défaut en conservant la query (`?arrivee=…`).
 */
function LegacyRoomRedirect() {
  const { id } = useParams<{ id: string }>();
  const { search } = useLocation();
  return (
    <Navigate
      to={`/${MARKETS[0].slug}/chambre/${encodeURIComponent(id ?? '')}${search}`}
      replace
    />
  );
}

function AppRoutes() {
  return (
    <MarketProvider>
      <ScrollToTop />
      {/* Pas de key={pathname} : React Router reconcilie les routes sans
          remonter tout l'arbre (header, footer, états, effets). */}
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/a-propos" element={<AProposPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/chambre/:id" element={<LegacyRoomRedirect />} />
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
  return (
    <FavoritesProvider>
      <AppRoutes />
    </FavoritesProvider>
  );
}
