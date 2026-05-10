import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Gift, Clock, User } from "lucide-react";

export default function WheelOfNames() {
  const { user, isAuthenticated } = useAuth();
  const [spinRotation, setSpinRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [submissionName, setSubmissionName] = useState("");
  const [showPaidModal, setShowPaidModal] = useState(false);
  const [paidQuantity, setPaidQuantity] = useState(1);
  const [countdownTime, setCountdownTime] = useState("");

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
    if (!entries || entries.length === 0) return;
    setIsSpinning(true);
    const spins = Math.random() * 360 + 720;
    setSpinRotation(prev => prev + spins);
    setTimeout(() => setIsSpinning(false), 3000);
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="font-['Anton'] text-6xl md:text-8xl uppercase tracking-wider text-red-600 mb-3">
            DAILY FREE PROMO WHEEL
          </h1>
          <p className="text-white/60 text-lg">Win a free promo post daily at 7pm</p>
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
                <div className="absolute inset-0 rounded-full opacity-30 border-8 border-dashed border-red-400" />
              </div>

              {/* Pointer at top */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
                <div className="w-0 h-0 border-l-6 border-r-6 border-t-8 border-l-transparent border-r-transparent border-t-red-600" />
              </div>
            </div>

            {/* Spin Button */}
            <Button
              onClick={handleSpin}
              disabled={isSpinning || !entries || entries.length === 0}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg mb-4"
            >
              {isSpinning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  SPINNING...
                </>
              ) : (
                "SPIN THE WHEEL"
              )}
            </Button>

            {/* Countdown */}
            <div className="w-full bg-white/5 border border-white/10 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-white/60 mb-2">
                <Clock className="w-4 h-4" />
                Next Spin
              </div>
              <div className="font-['Anton'] text-2xl text-red-600">{countdownTime}</div>
            </div>
          </div>

          {/* Middle: Submission Form */}
          <div className="md:col-span-1">
            <Card className="bg-white/5 border-white/10 p-6 h-full">
              <h2 className="font-['Anton'] text-2xl uppercase mb-4 text-red-600">Submit Your Name</h2>

              {!isAuthenticated ? (
                <div className="text-center py-8">
                  <p className="text-white/60 mb-4">Log in to submit your name</p>
                  <Button className="w-full bg-red-600 hover:bg-red-700">Sign In</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-white/60 uppercase tracking-widest block mb-2">Your Name</label>
                    <Input
                      type="text"
                      placeholder="Enter your name"
                      value={submissionName}
                      onChange={(e) => setSubmissionName(e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                      maxLength={128}
                    />
                  </div>

                  <Button
                    onClick={() => submitNameMutation.mutate({ name: submissionName })}
                    disabled={!submissionName.trim() || submitNameMutation.isPending}
                    className="w-full bg-red-600 hover:bg-red-700"
                  >
                    {submitNameMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Name"
                    )}
                  </Button>

                  <Button
                    onClick={() => setShowPaidModal(true)}
                    variant="outline"
                    className="w-full border-red-600/50 text-red-400 hover:bg-red-600/10"
                  >
                    Buy Additional Entries ($5 each)
                  </Button>

                  {submitNameMutation.error && (
                    <div className="text-sm text-red-400 bg-red-600/10 border border-red-600/30 rounded p-3">
                      {submitNameMutation.error.message}
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>

          {/* Right: Info & Winner */}
          <div className="md:col-span-1 space-y-4">
            {/* Total Entries */}
            <Card className="bg-white/5 border-white/10 p-6">
              <div className="flex items-center gap-3 mb-2">
                <Gift className="w-5 h-5 text-red-600" />
                <span className="text-white/60 text-sm uppercase tracking-widest">Total Entries</span>
              </div>
              <div className="font-['Anton'] text-4xl text-red-600">
                {entriesLoading ? "..." : entries?.length || 0}
              </div>
            </Card>

            {/* Last Winner */}
            <Card className="bg-white/5 border-white/10 p-6">
              <div className="flex items-center gap-3 mb-3">
                <User className="w-5 h-5 text-red-600" />
                <span className="text-white/60 text-sm uppercase tracking-widest">Last Winner</span>
              </div>
              {lastWinner ? (
                <div>
                  <div className="font-['Anton'] text-2xl text-red-600 mb-1">{lastWinner.winnerName}</div>
                  <div className="text-xs text-white/40">{lastWinner.spinDate}</div>
                </div>
              ) : (
                <p className="text-white/40">No winner yet</p>
              )}
            </Card>

            {/* Today's Result */}
            {todaysSpin && (
              <Card className="bg-red-600/10 border-red-600/30 p-6">
                <div className="text-sm text-red-400 uppercase tracking-widest mb-2">Today's Winner</div>
                <div className="font-['Anton'] text-2xl text-red-600">{todaysSpin.winnerName}</div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Paid Entries Modal */}
      {showPaidModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <Card className="bg-[#080808] border-white/20 p-8 max-w-md w-full">
            <h3 className="font-['Anton'] text-2xl uppercase mb-4 text-red-600">Buy Additional Entries</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/60 uppercase tracking-widest block mb-2">Quantity</label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={paidQuantity}
                  onChange={(e) => setPaidQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
              <div className="bg-white/5 border border-white/10 rounded p-4">
                <div className="text-white/60 text-sm mb-1">Total Cost</div>
                <div className="font-['Anton'] text-3xl text-red-600">${(paidQuantity * 5).toFixed(2)}</div>
              </div>
              <Button
                onClick={() => buyEntriesMutation.mutate({ quantity: paidQuantity })}
                disabled={buyEntriesMutation.isPending}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                {buyEntriesMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Buy Entries"
                )}
              </Button>
              <Button
                onClick={() => setShowPaidModal(false)}
                variant="outline"
                className="w-full border-white/20"
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
