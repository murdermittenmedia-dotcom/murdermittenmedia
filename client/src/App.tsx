import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AudioPlayerProvider } from "./contexts/AudioPlayerContext";
import FloatingPlayer from "./components/FloatingPlayer";
import { useLivePlayer } from "./hooks/useLivePlayer";
import { useAuth } from "./_core/hooks/useAuth";
import { useWarsLivePlayer } from "./hooks/useWarsLivePlayer";
import { usePageTracker } from "./hooks/usePageTracker";
import Home from "./pages/Home";
import Promo from "./pages/Promo";
import MurderMittenMic from "./pages/MurderMittenMic";
import MeetingWithTheMitten from "./pages/MeetingWithTheMitten";
import MusicReview from "./pages/MusicReview";
import ArtistOfWeek from "./pages/ArtistOfWeek";
import LiveStream from "./pages/LiveStream";
import MusicWars from "./pages/MusicWars";
import UserProfile from "./pages/UserProfile";
import Forum from "./pages/Forum";
import ForumPost from "./pages/ForumPost";
import Leaderboard from "./pages/Leaderboard";
import Search from "./pages/Search";
import AdminModeration from "./pages/AdminModeration";
import AdminPanel from "./pages/AdminPanel";
import AdminSiteStats from "./pages/AdminSiteStats";
import Banned from "./pages/Banned";
import WheelOfNames from "./pages/WheelOfNames";
import HowItWorks from "./pages/HowItWorks";
import LiveCookUp from "./pages/CookUp";
import CookUpStream from "./pages/CookUpStream";
import Coins from "./pages/Coins";
import { PWAInstallBanner } from "./components/PWAInstallBanner";
import FireOrTrash from "./pages/FireOrTrash";
import Wallet from "./pages/Wallet";
import News from "./pages/News";
import Notifications from "./pages/Notifications";
import FireVoteWallet from "./pages/FireVoteWallet";
import CreatorWallet from "./pages/CreatorWallet";
import StreamHistory from "./pages/StreamHistory";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Merch from "./pages/Merch";
import OrderConfirmation from "./pages/OrderConfirmation";
import AdminMerch from "./pages/AdminMerch";
import AdminShop from "./pages/AdminShop";
import AdminShopForm from "./pages/AdminShopForm";
import ShopProduct from "./pages/ShopProduct";
import GoldenWheel from "./pages/GoldenWheel";
import AdminGoldenWheel from "./pages/AdminGoldenWheel";
import OrderHistory from "./pages/OrderHistory";
import OrderDetail from "./pages/OrderDetail";
import FindStudio from "./pages/FindStudio";

function Router() {
  return (
    <Switch>
      {/* Core pages */}
      <Route path={"/"} component={Home} />
      <Route path={"/promo"} component={Promo} />
      <Route path={"/merch"} component={Merch} />
      <Route path={"/shop"} component={Merch} />
      <Route path={"/order-confirmation"} component={OrderConfirmation} />
      <Route path={"/golden-wheel"} component={GoldenWheel} />
      <Route path={"/admin/merch"} component={AdminMerch} />
      <Route path={"/admin/shop"} component={AdminShop} />
      <Route path={"/admin/shop/new"} component={AdminShopForm} />
      <Route path={"/admin/shop/edit/:id"} component={AdminShopForm} />
      <Route path={"/shop/:slug"} component={ShopProduct} />
      <Route path={"/find-studio"} component={FindStudio} />
      <Route path={"/mic"} component={MurderMittenMic} />
      <Route path={"/podcast"} component={MeetingWithTheMitten} />
      <Route path={"/review"} component={MusicReview} />
      <Route path={"/artist-of-the-week"} component={ArtistOfWeek} />
      <Route path={"/live"} component={LiveStream} />
      <Route path={"/music-wars"} component={MusicWars} />

      {/* Daily Free Promo Wheel */}
      <Route path={"/daily-wheel"} component={WheelOfNames} />
      <Route path={"/wheel"} component={WheelOfNames} />

      {/* Live Cook Up */}
      <Route path={"/cookup"} component={LiveCookUp} />
      <Route path={"/cookup/:id"} component={CookUpStream} />
      <Route path={"/coins"} component={Coins} />
      <Route path={"/fire-or-trash"} component={FireOrTrash} />
      <Route path={"/cashout"} component={Wallet} />
      <Route path={"/wallet"} component={Wallet} />
      <Route path={"/news"} component={News} />
      <Route path={"/notifications"} component={Notifications} />
      <Route path={"/fire-vote-wallet"} component={FireVoteWallet} />
      <Route path={"/creator-wallet"} component={CreatorWallet} />
      <Route path={"/stream-history"} component={StreamHistory} />

      {/* XP & Tiers explainer */}
      <Route path={"/how-it-works"} component={HowItWorks} />

      {/* User profile */}
      <Route path={"/profile"} component={UserProfile} />
      <Route path={"/profile/:id"} component={UserProfile} />

      {/* Account & Orders */}
      <Route path={"/account"} component={UserProfile} />
      <Route path={"/account/orders"} component={OrderHistory} />
      <Route path={"/account/orders/:orderId"} component={OrderDetail} />

      {/* Explore */}
      <Route path={"/forum"} component={Forum} />
      <Route path={"/forum/:id"}>
        {(params) => <ForumPost params={params} />}
      </Route>
      <Route path={"/leaderboard"} component={Leaderboard} />

      {/* Explore — new canonical route (old /search redirects here) */}
      <Route path={"/explore"} component={Search} />
      <Route path={"/search"}>
        <Redirect to="/explore" />
      </Route>

      {/* Admin */}
      <Route path={"/admin"} component={AdminPanel} />
      <Route path={"/admin/moderation"} component={AdminModeration} />
      <Route path={"/admin/stats"} component={AdminSiteStats} />
      <Route path={"/admin/golden-wheel"} component={AdminGoldenWheel} />

      {/* Ban appeal */}
      <Route path={"/banned"} component={Banned} />

      {/* Legal */}
      <Route path={"/privacy-policy"} component={PrivacyPolicy} />
      <Route path={"/privacy"} component={PrivacyPolicy} />

      {/* Fallback */}
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

/** Mounts the live-player listeners inside AudioPlayerProvider context */
function LivePlayerMount() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  useLivePlayer({ isAdmin });
  useWarsLivePlayer();
  return null;
}

/** Tracks page views and heartbeats for admin analytics */
function PageTrackerMount() {
  usePageTracker();
  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <AudioPlayerProvider>
          <TooltipProvider>
            <Toaster />
            {/* Global live-review listener: auto-plays admin-selected tracks on every page */}
            <LivePlayerMount />
            {/* Page view tracker for admin analytics */}
            <PageTrackerMount />
            <Router />
            <FloatingPlayer />
            <PWAInstallBanner />
          </TooltipProvider>
        </AudioPlayerProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
