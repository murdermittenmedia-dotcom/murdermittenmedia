import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Gift, Clock, User, Home, Zap, Trash2 } from "lucide-react";
import { useLocation } from "wouter";

export default function WheelOfNames() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [spinRotation, setSpinRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [submissionName, setSubmissionName] = useState("");
  const [showPaidModal, setShowPaidModal] = useState(false);
  const [paidQuantity, setPaidQuantity] = useState(1);
  const [countdownTime, setCountdownTime] = useState("");
  const [adminNameInput, setAdminNameInput] = useState("");

  // Queries
  const { data: entries, isLoading: entriesLoading, refetch: refetchEntries } = trpc.promoWheel.getEntries.useQuery();
  const { data: lastWinner } = trpc.promoWheel.getLastWinner.useQuery();
  const { data: todaysSpin } = trpc.promoWheel.getTodaysSpin.useQuery();

  // Mutations
  const submitNameMutation = trpc.promoWheel.submitName.useMutation({
    onSuccess: () => {
      setSubmissionName("");
      refetchEntries();
    },
  });

  const adminAddNameMutation = trpc.promoWheel.adminAddName.useMutation({
    onSuccess: () => {
      setAdminNameInput("");
      refetchEntries();
    },
  });

  const adminRemoveNameMutation = trpc.promoWheel.adminRemoveName.useMutation({
    onSuccess: () => {
      refetchEntries();
    },
  });

  const buyEntriesMutation = trpc.promoWheel.buyEntries.useMutation({
    onSuccess: () => {
      setPaidQuantity(1);
      setShowPaidModal(false);
    },
  });

  // Calculate countdown to 7pm
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0, 0); // 7pm
      
      if (now > today) {
        today.setDate(today.getDate() + 1);
      }

      const diff = today.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdownTime(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Simulate wheel spin
  const handleSpin = () => {
    if (!isAuthenticated) return;
    setIsSpinning(true);
    const spins = Math.random() * 360 + 720;
    setSpinRotation(prev => prev + spins);
    setTimeout(() => setIsSpinning(false), 3000);
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header with home button */}
        <div className="flex items-start justify-between mb-12 gap-4">
          <div className="text-center flex-1">
            <h1 className="font-['Anton'] text-6xl md:text-8xl uppercase tracking-wider text-red-600 mb-3">
              DAILY FREE PROMO WHEEL
            </h1>
            <p className="text-white/60 text-lg">Win a free promo post daily at 7pm</p>
          </div>
          <a
            href="/"
            className="flex items-center gap-2 px-4 py-2 border border-white/20 text-white/60 hover:border-red-600 hover:text-red-400 transition-all duration-200 rounded-sm flex-shrink-0 mt-2"
            title="Back to home"
          >
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline text-xs uppercase tracking-widest font-medium">Home</span>
          </a>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Left: Wheel Visualization */}
          <div className="md:col-span-1 flex flex-col items-center">
            <div className="relative w-64 h-64 mb-6">
              {/* Wheel circle */}
              <div
                className={`absolute inset-0 rounded-full border-4 border-red-600 bg-gradient-to-br from-red-600/20 to-red-900/20 flex items-center justify-center transition-transform ${
                  isSpinning ? "" : ""
                }`}
                style={{
                  transform: `rotate(${spinRotation}deg)`,
                  transitionDuration: isSpinning ? "3s" : "0s",
                }}
              >
                {/* Wheel segments */}
                {entries?.slice(0, 12).map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-px h-24 bg-white/20 origin-bottom"
                    style={{ transform: `rotate(${(i * 360) / 12}deg) translateY(-48px)` }}
                  />
                ))}
                {/* Center circle */}
                <div className="w-12 h-12 rounded-full bg-red-600/30 border border-red-600" />
              </div>

              {/* Knife pointer at top */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0 border-l-6 border-r-6 border-t-8 border-l-transparent border-r-transparent border-t-red-600 z-10" />
            </div>

            {/* Previous Winner */}
            {lastWinner && (
              <div className="text-center mb-6 w-full">
                <p className="text-white/60 text-sm mb-2">Last Winner</p>
                <p className="font-['Anton'] text-2xl text-red-600">{lastWinner.winnerName}</p>
              </div>
            )}

            {/* Countdown */}
            <div className="flex items-center gap-2 text-white/60 text-sm mb-6">
              <Clock className="w-4 h-4" />
              <span>Next spin: {countdownTime}</span>
            </div>

            {/* Spin Button */}
            <Button
              onClick={handleSpin}
              disabled={isSpinning || !isAuthenticated}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              {isSpinning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Gift className="w-4 h-4 mr-2" />}
              {isSpinning ? "Spinning..." : "View Wheel"}
            </Button>
          </div>

          {/* Right: Submission Form & Names List */}
          <div className="md:col-span-2">
            {/* Submission Form */}
            {isAuthenticated ? (
              <Card className="p-6 bg-white/[0.03] border-white/10 mb-6">
                <h2 className="text-xl font-['Anton'] text-red-600 mb-4">Submit Your Name</h2>
                <div className="flex gap-2 mb-4">
                  <Input
                    type="text"
                    placeholder="Enter your name..."
                    value={submissionName}
                    onChange={(e) => setSubmissionName(e.target.value)}
                    maxLength={128}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => submitNameMutation.mutate({ name: submissionName })}
                    disabled={!submissionName || submitNameMutation.isPending}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {submitNameMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit"}
                  </Button>
                </div>
                <p className="text-white/40 text-xs">1 free entry per account. Buy more for $5 each.</p>
                <Button
                  onClick={() => setShowPaidModal(true)}
                  variant="outline"
                  className="w-full mt-4 border-red-600/30 text-white/60 hover:border-red-600 hover:text-red-400"
                >
                  Buy Additional Entries
                </Button>
              </Card>
            ) : (
              <Card className="p-6 bg-white/[0.03] border-white/10 mb-6 text-center">
                <p className="text-white/60 mb-4">Log in to submit your name</p>
                <Button className="bg-red-600 hover:bg-red-700">Sign In</Button>
              </Card>
            )}

            {/* Names List */}
            <div>
              <h2 className="text-2xl font-['Anton'] mb-4 text-red-600">Current Entries ({entries?.length || 0})</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-96 overflow-y-auto border border-white/10 p-4 rounded bg-white/[0.03]">
                {entries && entries.length > 0 ? (
                  entries.map((entry, idx) => (
                    <div key={entry.id} className="p-3 border border-red-600/30 bg-red-600/10 rounded text-center text-sm relative group">
                      <div className="font-semibold text-white">{entry.name}</div>
                      <div className="text-white/40 text-xs mt-1">#{idx + 1}</div>
                      
                      {/* Admin remove button */}
                      {user?.role === "admin" && (
                        <button
                          onClick={() => adminRemoveNameMutation.mutate({ entryId: entry.id })}
                          className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 rounded-full p-1 hover:bg-red-700"
                          title="Remove entry"
                        >
                          <Trash2 className="w-3 h-3 text-white" />
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="col-span-full text-center text-white/40 py-8">No entries yet</div>
                )}
              </div>

              {/* Admin: Add Name Manually */}
              {user?.role === "admin" && (
                <div className="mt-6 p-4 border border-red-600/30 bg-red-600/5 rounded">
                  <h3 className="text-lg font-['Anton'] text-red-600 mb-3">Admin: Add Name Manually</h3>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Enter name..."
                      value={adminNameInput}
                      onChange={(e) => setAdminNameInput(e.target.value)}
                      maxLength={128}
                      className="flex-1"
                    />
                    <Button
                      onClick={() => adminAddNameMutation.mutate({ name: adminNameInput })}
                      disabled={!adminNameInput || adminAddNameMutation.isPending}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {adminAddNameMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Paid Entries Modal */}
      {showPaidModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <Card className="bg-[#080808] border-white/10 max-w-md w-full p-6">
            <h2 className="text-2xl font-['Anton'] text-red-600 mb-4">Buy Additional Entries</h2>
            <div className="mb-4">
              <label className="text-white/60 text-sm mb-2 block">Quantity</label>
              <Input
                type="number"
                min="1"
                max="100"
                value={paidQuantity}
                onChange={(e) => setPaidQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="mb-2"
              />
              <p className="text-white/40 text-sm">${paidQuantity * 5} total</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => buyEntriesMutation.mutate({ quantity: paidQuantity })}
                disabled={buyEntriesMutation.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {buyEntriesMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Buy"}
              </Button>
              <Button
                onClick={() => setShowPaidModal(false)}
                variant="outline"
                className="flex-1 border-white/20"
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
