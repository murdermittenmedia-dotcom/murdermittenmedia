import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AudioPlayerProvider } from "./contexts/AudioPlayerContext";
import FloatingPlayer from "./components/FloatingPlayer";
import { useLivePlayer } from "./hooks/useLivePlayer";
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

function Router() {
  return (
    <Switch>
      {/* Core pages */}
      <Route path={"/"} component={Home} />
      <Route path={"/promo"} component={Promo} />
      <Route path={"/mic"} component={MurderMittenMic} />
      <Route path={"/podcast"} component={MeetingWithTheMitten} />
      <Route path={"/review"} component={MusicReview} />
      <Route path={"/artist-of-the-week"} component={ArtistOfWeek} />
      <Route path={"/live"} component={LiveStream} />
      <Route path={"/music-wars"} component={MusicWars} />

      {/* Daily Free Promo Wheel */}
      <Route path={"/daily-wheel"} component={WheelOfNames} />

      {/* User profile */}
      <Route path={"/profile"} component={UserProfile} />
      <Route path={"/profile/:id"} component={UserProfile} />

      {/* Community */}
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

      {/* Ban appeal */}
      <Route path={"/banned"} component={Banned} />

      {/* Fallback */}
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

/** Mounts the live-player listeners inside AudioPlayerProvider context */
function LivePlayerMount() {
  useLivePlayer();
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
          </TooltipProvider>
        </AudioPlayerProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
