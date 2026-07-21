import { useState } from "react";
import { MapPin, Phone, Mail, Instagram, Twitter, Facebook, Youtube, Music, Star, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

export default function FindStudio() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudio, setSelectedStudio] = useState<number | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewData, setReviewData] = useState({
    rating: 5,
    title: "",
    reviewText: "",
    guestName: "",
    guestEmail: "",
  });

  const { user } = useAuth();
  const { data: studios = [] } = trpc.studios.getAll.useQuery();
  const { data: reviews = [] } = trpc.studios.getReviews.useQuery(
    { studioId: selectedStudio || 0 },
    { enabled: !!selectedStudio }
  );

  const createReviewMutation = trpc.studios.createReview.useMutation({
    onSuccess: () => {
      setReviewData({ rating: 5, title: "", reviewText: "", guestName: "", guestEmail: "" });
      setShowReviewForm(false);
      alert("Review submitted! Thank you.");
    },
    onError: (error) => {
      alert(`Error: ${error.message}`);
    },
  });

  const filteredStudios = studios.filter(
    (studio) =>
      studio.studioName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      studio.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentStudio = studios.find((s) => s.id === selectedStudio);

  const handleSubmitReview = () => {
    if (!selectedStudio) return;
    if (!reviewData.title.trim() || !reviewData.reviewText.trim()) {
      alert("Please fill in title and review");
      return;
    }
    if (!user && (!reviewData.guestName.trim() || !reviewData.guestEmail.trim())) {
      alert("Please provide your name and email");
      return;
    }

    createReviewMutation.mutate({
      studioId: selectedStudio,
      rating: reviewData.rating,
      title: reviewData.title,
      reviewText: reviewData.reviewText,
      guestName: reviewData.guestName,
      guestEmail: reviewData.guestEmail,
    });
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white pt-24 pb-12">
      <div className="container max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-['Anton'] mb-2">Find A Studio</h1>
          <p className="text-white/60">Discover recording studios and book engineers in Michigan</p>
        </div>

        {/* Search */}
        <div className="mb-8">
          <Input
            placeholder="Search by studio name or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Studios List */}
          <div className="lg:col-span-1">
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredStudios.length === 0 ? (
                <div className="text-white/40 text-center py-8">No studios found</div>
              ) : (
                filteredStudios.map((studio) => (
                  <button
                    key={studio.id}
                    onClick={() => {
                      setSelectedStudio(studio.id);
                      setShowReviewForm(false);
                    }}
                    className={`w-full text-left p-4 rounded-lg border transition-all ${
                      selectedStudio === studio.id
                        ? "bg-red-600/20 border-red-600/50"
                        : "bg-white/5 border-white/10 hover:bg-white/10"
                    }`}
                  >
                    <div className="font-semibold text-sm">{studio.studioName}</div>
                    <div className="text-xs text-white/60 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {studio.location}
                    </div>
                    {studio.reviewCount > 0 && (
                      <div className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                        <Star className="w-3 h-3 fill-yellow-400" />
                        {studio.averageRating} ({studio.reviewCount} reviews)
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Studio Details */}
          <div className="lg:col-span-2">
            {currentStudio ? (
              <div className="space-y-6">
                {/* Studio Info */}
                <Card className="bg-white/5 border-white/10 p-6">
                  <h2 className="text-2xl font-bold mb-4">{currentStudio.studioName}</h2>

                  {currentStudio.imageUrl && (
                    <img
                      src={currentStudio.imageUrl}
                      alt={currentStudio.studioName}
                      className="w-full h-48 object-cover rounded-lg mb-4"
                    />
                  )}

                  {currentStudio.description && (
                    <p className="text-white/80 mb-4">{currentStudio.description}</p>
                  )}

                  {/* Location */}
                  <div className="flex items-start gap-3 mb-4">
                    <MapPin className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-semibold">Location</div>
                      <div className="text-white/60">{currentStudio.location}</div>
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="flex items-start gap-3 mb-4">
                    <Phone className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-semibold">Contact</div>
                      <div className="text-white/60">{currentStudio.contactInfo}</div>
                    </div>
                  </div>

                  {/* Engineers */}
                  {currentStudio.engineers && (
                    <div className="mb-4">
                      <div className="text-sm font-semibold mb-2">Engineers to Book</div>
                      <div className="text-white/60">{currentStudio.engineers}</div>
                    </div>
                  )}

                  {/* Social Links */}
                  <div className="flex gap-3 flex-wrap">
                    {currentStudio.instagramHandle && (
                      <a
                        href={`https://instagram.com/${currentStudio.instagramHandle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/60 hover:text-red-600 transition-colors"
                        title="Instagram"
                      >
                        <Instagram className="w-5 h-5" />
                      </a>
                    )}
                    {currentStudio.twitterHandle && (
                      <a
                        href={`https://twitter.com/${currentStudio.twitterHandle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/60 hover:text-red-600 transition-colors"
                        title="Twitter"
                      >
                        <Twitter className="w-5 h-5" />
                      </a>
                    )}
                    {currentStudio.facebookUrl && (
                      <a
                        href={currentStudio.facebookUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/60 hover:text-red-600 transition-colors"
                        title="Facebook"
                      >
                        <Facebook className="w-5 h-5" />
                      </a>
                    )}
                    {currentStudio.youtubeChannel && (
                      <a
                        href={currentStudio.youtubeChannel}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/60 hover:text-red-600 transition-colors"
                        title="YouTube"
                      >
                        <Youtube className="w-5 h-5" />
                      </a>
                    )}
                    {currentStudio.tiktokHandle && (
                      <a
                        href={`https://tiktok.com/@${currentStudio.tiktokHandle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/60 hover:text-red-600 transition-colors"
                        title="TikTok"
                      >
                        <Music className="w-5 h-5" />
                      </a>
                    )}
                  </div>
                </Card>

                {/* Rating */}
                {currentStudio.reviewCount > 0 && (
                  <Card className="bg-white/5 border-white/10 p-4">
                    <div className="flex items-center gap-2">
                      <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      <span className="font-bold">{currentStudio.averageRating}</span>
                      <span className="text-white/60">({currentStudio.reviewCount} reviews)</span>
                    </div>
                  </Card>
                )}

                {/* Reviews */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      Reviews
                    </h3>
                    <Button
                      onClick={() => setShowReviewForm(!showReviewForm)}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      {showReviewForm ? "Cancel" : "Write Review"}
                    </Button>
                  </div>

                  {/* Review Form */}
                  {showReviewForm && (
                    <Card className="bg-white/5 border-white/10 p-6 mb-6">
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-semibold mb-2 block">Rating</label>
                          <select
                            value={reviewData.rating}
                            onChange={(e) =>
                              setReviewData({ ...reviewData, rating: parseInt(e.target.value) })
                            }
                            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white"
                          >
                            {[5, 4, 3, 2, 1].map((r) => (
                              <option key={r} value={r}>
                                {r} Star{r !== 1 ? "s" : ""}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-sm font-semibold mb-2 block">Title</label>
                          <Input
                            placeholder="Review title"
                            value={reviewData.title}
                            onChange={(e) =>
                              setReviewData({ ...reviewData, title: e.target.value })
                            }
                            className="bg-white/5 border-white/10 text-white"
                          />
                        </div>

                        <div>
                          <label className="text-sm font-semibold mb-2 block">Review</label>
                          <Textarea
                            placeholder="Share your experience..."
                            value={reviewData.reviewText}
                            onChange={(e) =>
                              setReviewData({ ...reviewData, reviewText: e.target.value })
                            }
                            className="bg-white/5 border-white/10 text-white"
                            rows={4}
                          />
                        </div>

                        {!user && (
                          <>
                            <div>
                              <label className="text-sm font-semibold mb-2 block">Your Name</label>
                              <Input
                                placeholder="Name"
                                value={reviewData.guestName}
                                onChange={(e) =>
                                  setReviewData({ ...reviewData, guestName: e.target.value })
                                }
                                className="bg-white/5 border-white/10 text-white"
                              />
                            </div>

                            <div>
                              <label className="text-sm font-semibold mb-2 block">Email</label>
                              <Input
                                type="email"
                                placeholder="Email"
                                value={reviewData.guestEmail}
                                onChange={(e) =>
                                  setReviewData({ ...reviewData, guestEmail: e.target.value })
                                }
                                className="bg-white/5 border-white/10 text-white"
                              />
                            </div>
                          </>
                        )}

                        <Button
                          onClick={handleSubmitReview}
                          disabled={createReviewMutation.isPending}
                          className="w-full bg-red-600 hover:bg-red-700 text-white"
                        >
                          {createReviewMutation.isPending ? "Submitting..." : "Submit Review"}
                        </Button>
                      </div>
                    </Card>
                  )}

                  {/* Reviews List */}
                  <div className="space-y-4">
                    {reviews.length === 0 ? (
                      <div className="text-white/40 text-center py-8">No reviews yet</div>
                    ) : (
                      reviews.map((review) => (
                        <Card key={review.id} className="bg-white/5 border-white/10 p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="font-semibold">{review.title}</div>
                              <div className="text-sm text-white/60">
                                {review.guestName || user?.name || "Anonymous"}
                              </div>
                            </div>
                            <div className="flex gap-1">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-4 h-4 ${
                                    i < review.rating
                                      ? "fill-yellow-400 text-yellow-400"
                                      : "text-white/20"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                          <p className="text-white/80 text-sm">{review.reviewText}</p>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-white/40 text-center py-12">Select a studio to view details</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
