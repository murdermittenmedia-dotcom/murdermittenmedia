import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AudioPlayerProvider } from "./contexts/AudioPlayerContext";
import FloatingPlayer from "./components/FloatingPlayer";
import Home from "./pages/Home";
import Promo from "./pages/Promo";
import MurderMittenMic from "./pages/MurderMittenMic";
import MeetingWithTheMitten from "./pages/MeetingWithTheMitten";
import MusicReview from "./pages/MusicReview";
import ArtistOfWeek from "./pages/ArtistOfWeek";
import LiveStream from "./pages/LiveStream";
import MusicWars from "./pages/MusicWars";
import UserProfile from "./pages/UserProfile";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/promo"} component={Promo} />
      <Route path={"/mic"} component={MurderMittenMic} />
      <Route path={"/podcast"} component={MeetingWithTheMitten} />
      <Route path={"/review"} component={MusicReview} />
      <Route path={"/artist-of-the-week"} component={ArtistOfWeek} />
      <Route path={"/live"} component={LiveStream} />
      <Route path={"/music-wars"} component={MusicWars} />
      <Route path={"/profile"} component={UserProfile} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <AudioPlayerProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
            <FloatingPlayer />
          </TooltipProvider>
        </AudioPlayerProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
