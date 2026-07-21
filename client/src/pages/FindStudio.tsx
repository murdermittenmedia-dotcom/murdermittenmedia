import { useState } from "react";
import { MapPin, Phone, Mail, Instagram, Twitter, Facebook, Youtube, Music, Star, MessageSquare, Plus, Edit2, Trash2, X, Search, MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

export default function FindStudio() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudio, setSelectedStudio] = useState<number | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminFormData, setAdminFormData] = useState({
    studioName: "",
    location: "",
    latitude: "",
    longitude: "",
    engineers: "",
    contactInfo: "",
    instagramHandle: "",
    twitterHandle: "",
    facebookUrl: "",
    websiteUrl: "",
    youtubeChannel: "",
    tiktokHandle: "",
    description: "",
  });
  const [reviewData, setReviewData] = useState({
    rating: 5,
    title: "",
    reviewText: "",
    guestName: "",
    guestEmail: "",
  });

  const { user } = useAuth();
  const { data: studios = [], refetch: refetchStudios } = trpc.studios.getAll.useQuery();
  const { data: reviews = [] } = trpc.studios.getReviews.useQuery(
    { studioId: selectedStudio || 0 },
    { enabled: !!selectedStudio }
  );

  const createStudioMutation = trpc.studios.create.useMutation({
    onSuccess: () => {
      toast.success("Studio created successfully!");
      setAdminFormData({
        studioName: "",
        location: "",
        latitude: "",
        longitude: "",
        engineers: "",
        contactInfo: "",
        instagramHandle: "",
        twitterHandle: "",
        facebookUrl: "",
        websiteUrl: "",
        youtubeChannel: "",
        tiktokHandle: "",
        description: "",
      });
      setShowAdminForm(false);
      refetchStudios();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create studio");
    },
  });

  const createReviewMutation = trpc.studios.createReview.useMutation({
    onSuccess: () => {
      toast.success("Review submitted successfully!");
      setReviewData({
        rating: 5,
        title: "",
        reviewText: "",
        guestName: "",
        guestEmail: "",
      });
      setShowReviewForm(false);
      refetchStudios();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to submit review");
    },
  });

  const handleCreateStudio = () => {
    if (!adminFormData.studioName.trim()) {
      toast.error("Studio name is required");
      return;
    }

    createStudioMutation.mutate({
      studioName: adminFormData.studioName,
      location: adminFormData.location || null,
      latitude: adminFormData.latitude ? parseFloat(adminFormData.latitude) : null,
      longitude: adminFormData.longitude ? parseFloat(adminFormData.longitude) : null,
      engineers: adminFormData.engineers || null,
      contactInfo: adminFormData.contactInfo || null,
      instagramHandle: adminFormData.instagramHandle || null,
      twitterHandle: adminFormData.twitterHandle || null,
      facebookUrl: adminFormData.facebookUrl || null,
      websiteUrl: adminFormData.websiteUrl || null,
      youtubeChannel: adminFormData.youtubeChannel || null,
      tiktokHandle: adminFormData.tiktokHandle || null,
      description: adminFormData.description || null,
    });
  };

  const handleSubmitReview = () => {
    if (!reviewData.reviewText.trim()) {
      toast.error("Review text is required");
      return;
    }

    createReviewMutation.mutate({
      studioId: selectedStudio || 0,
      rating: reviewData.rating,
      title: reviewData.title || "Review",
      reviewText: reviewData.reviewText,
      guestName: reviewData.guestName || "Anonymous",
      guestEmail: reviewData.guestEmail || null,
      isApproved: !!user,
    });
  };

  const selectedStudioData = studios.find((s) => s.id === selectedStudio);
  const filteredStudios = studios.filter((s) =>
    s.studioName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.location && s.location.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const isAdmin = user?.role === "admin";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#080808] via-[#0a0a0a] to-[#080808] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/40 backdrop-blur-sm sticky top-0 z-40">
        <div className="container py-8">
          <div className="flex items-center gap-3 mb-6">
            <MapIcon className="w-8 h-8 text-red-600" />
            <h1 className="text-4xl font-bold">FIND A STUDIO</h1>
          </div>
          <p className="text-white/60 max-w-2xl">Discover top-tier recording studios and connect with professional engineers in your area.</p>
        </div>
      </div>

      <div className="container py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Studio List */}
          <div className="lg:col-span-1">
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-white/40" />
                <Input
                  placeholder="Search studios..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                />
              </div>

              {/* Admin Button */}
              {isAdmin && (
                <Button
                  onClick={() => setShowAdminForm(!showAdminForm)}
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Studio
                </Button>
              )}

              {/* Admin Form */}
              {showAdminForm && isAdmin && (
                <Card className="p-6 bg-white/5 border-white/10">
                  <h3 className="text-lg font-bold mb-4">Add New Studio</h3>
                  <div className="space-y-3">
                    <Input
                      placeholder="Studio Name *"
                      value={adminFormData.studioName}
                      onChange={(e) => setAdminFormData({ ...adminFormData, studioName: e.target.value })}
                      className="bg-white/5 border-white/10"
                    />
                    <Input
                      placeholder="Location"
                      value={adminFormData.location}
                      onChange={(e) => setAdminFormData({ ...adminFormData, location: e.target.value })}
                      className="bg-white/5 border-white/10"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Latitude"
                        type="number"
                        step="0.0001"
                        value={adminFormData.latitude}
                        onChange={(e) => setAdminFormData({ ...adminFormData, latitude: e.target.value })}
                        className="bg-white/5 border-white/10"
                      />
                      <Input
                        placeholder="Longitude"
                        type="number"
                        step="0.0001"
                        value={adminFormData.longitude}
                        onChange={(e) => setAdminFormData({ ...adminFormData, longitude: e.target.value })}
                        className="bg-white/5 border-white/10"
                      />
                    </div>
                    <Input
                      placeholder="Engineers"
                      value={adminFormData.engineers}
                      onChange={(e) => setAdminFormData({ ...adminFormData, engineers: e.target.value })}
                      className="bg-white/5 border-white/10"
                    />
                    <Input
                      placeholder="Contact Info"
                      value={adminFormData.contactInfo}
                      onChange={(e) => setAdminFormData({ ...adminFormData, contactInfo: e.target.value })}
                      className="bg-white/5 border-white/10"
                    />
                    <Input
                      placeholder="Instagram Handle"
                      value={adminFormData.instagramHandle}
                      onChange={(e) => setAdminFormData({ ...adminFormData, instagramHandle: e.target.value })}
                      className="bg-white/5 border-white/10"
                    />
                    <Input
                      placeholder="Twitter Handle"
                      value={adminFormData.twitterHandle}
                      onChange={(e) => setAdminFormData({ ...adminFormData, twitterHandle: e.target.value })}
                      className="bg-white/5 border-white/10"
                    />
                    <Input
                      placeholder="Facebook URL"
                      value={adminFormData.facebookUrl}
                      onChange={(e) => setAdminFormData({ ...adminFormData, facebookUrl: e.target.value })}
                      className="bg-white/5 border-white/10"
                    />
                    <Input
                      placeholder="Website URL"
                      value={adminFormData.websiteUrl}
                      onChange={(e) => setAdminFormData({ ...adminFormData, websiteUrl: e.target.value })}
                      className="bg-white/5 border-white/10"
                    />
                    <Input
                      placeholder="YouTube Channel"
                      value={adminFormData.youtubeChannel}
                      onChange={(e) => setAdminFormData({ ...adminFormData, youtubeChannel: e.target.value })}
                      className="bg-white/5 border-white/10"
                    />
                    <Input
                      placeholder="TikTok Handle"
                      value={adminFormData.tiktokHandle}
                      onChange={(e) => setAdminFormData({ ...adminFormData, tiktokHandle: e.target.value })}
                      className="bg-white/5 border-white/10"
                    />
                    <Textarea
                      placeholder="Description"
                      value={adminFormData.description}
                      onChange={(e) => setAdminFormData({ ...adminFormData, description: e.target.value })}
                      className="bg-white/5 border-white/10 min-h-24"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={handleCreateStudio}
                        disabled={createStudioMutation.isPending}
                        className="flex-1 bg-red-600 hover:bg-red-700"
                      >
                        {createStudioMutation.isPending ? "Creating..." : "Create Studio"}
                      </Button>
                      <Button
                        onClick={() => setShowAdminForm(false)}
                        variant="outline"
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              {/* Studio List */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredStudios.length === 0 ? (
                  <div className="text-center py-8 text-white/40">
                    <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No studios found</p>
                  </div>
                ) : (
                  filteredStudios.map((studio) => (
                    <button
                      key={studio.id}
                      onClick={() => setSelectedStudio(studio.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedStudio === studio.id
                          ? "bg-red-600/20 border-red-600"
                          : "bg-white/5 border-white/10 hover:border-white/20"
                      }`}
                    >
                      <div className="font-semibold text-sm">{studio.studioName}</div>
                      <div className="text-xs text-white/60 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" />
                        {studio.location || "Location TBA"}
                      </div>
                      {studio.averageRating && parseInt(studio.averageRating) > 0 && (
                        <div className="text-xs text-yellow-500 flex items-center gap-1 mt-1">
                          <Star className="w-3 h-3 fill-yellow-500" />
                          {studio.averageRating} ({studio.reviewCount} reviews)
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Studio Details */}
          <div className="lg:col-span-2">
            {selectedStudioData ? (
              <div className="space-y-6">
                {/* Studio Header */}
                <Card className="p-8 bg-gradient-to-br from-white/10 to-white/5 border-white/10">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-3xl font-bold mb-2">{selectedStudioData.studioName}</h2>
                      {selectedStudioData.location && (
                        <div className="flex items-center gap-2 text-white/60">
                          <MapPin className="w-4 h-4" />
                          {selectedStudioData.location}
                        </div>
                      )}
                    </div>
                    {selectedStudioData.averageRating && parseInt(selectedStudioData.averageRating) > 0 && (
                      <div className="text-right">
                        <div className="flex items-center gap-2 justify-end mb-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-5 h-5 ${
                                i < Math.round(parseFloat(selectedStudioData.averageRating))
                                  ? "fill-yellow-500 text-yellow-500"
                                  : "text-white/20"
                              }`}
                            />
                          ))}
                        </div>
                        <div className="text-sm text-white/60">{selectedStudioData.reviewCount} reviews</div>
                      </div>
                    )}
                  </div>

                  {selectedStudioData.description && (
                    <p className="text-white/70 mb-6">{selectedStudioData.description}</p>
                  )}

                  {/* Info Grid */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {selectedStudioData.engineers && (
                      <div>
                        <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Engineers</div>
                        <div className="text-sm">{selectedStudioData.engineers}</div>
                      </div>
                    )}
                    {selectedStudioData.contactInfo && (
                      <div>
                        <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Contact</div>
                        <div className="text-sm flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          {selectedStudioData.contactInfo}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Social Links */}
                  <div className="flex gap-3 flex-wrap">
                    {selectedStudioData.instagramHandle && (
                      <a
                        href={`https://instagram.com/${selectedStudioData.instagramHandle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                      >
                        <Instagram className="w-4 h-4" />
                      </a>
                    )}
                    {selectedStudioData.twitterHandle && (
                      <a
                        href={`https://twitter.com/${selectedStudioData.twitterHandle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                      >
                        <Twitter className="w-4 h-4" />
                      </a>
                    )}
                    {selectedStudioData.facebookUrl && (
                      <a
                        href={selectedStudioData.facebookUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                      >
                        <Facebook className="w-4 h-4" />
                      </a>
                    )}
                    {selectedStudioData.youtubeChannel && (
                      <a
                        href={selectedStudioData.youtubeChannel}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                      >
                        <Youtube className="w-4 h-4" />
                      </a>
                    )}
                    {selectedStudioData.websiteUrl && (
                      <a
                        href={selectedStudioData.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                      >
                        <Mail className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </Card>

                {/* Reviews Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-2xl font-bold flex items-center gap-2">
                      <MessageSquare className="w-6 h-6" />
                      Reviews
                    </h3>
                    <Button
                      onClick={() => setShowReviewForm(!showReviewForm)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Review
                    </Button>
                  </div>

                  {showReviewForm && (
                    <Card className="p-6 bg-white/5 border-white/10 mb-6">
                      <h4 className="font-bold mb-4">Submit Your Review</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm text-white/60 mb-2 block">Rating</label>
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                onClick={() => setReviewData({ ...reviewData, rating: star })}
                                className="transition-transform hover:scale-110"
                              >
                                <Star
                                  className={`w-6 h-6 ${
                                    star <= reviewData.rating
                                      ? "fill-yellow-500 text-yellow-500"
                                      : "text-white/20"
                                  }`}
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                        <Input
                          placeholder="Review Title"
                          value={reviewData.title}
                          onChange={(e) => setReviewData({ ...reviewData, title: e.target.value })}
                          className="bg-white/5 border-white/10"
                        />
                        <Textarea
                          placeholder="Your review..."
                          value={reviewData.reviewText}
                          onChange={(e) => setReviewData({ ...reviewData, reviewText: e.target.value })}
                          className="bg-white/5 border-white/10 min-h-24"
                        />
                        {!user && (
                          <>
                            <Input
                              placeholder="Your Name"
                              value={reviewData.guestName}
                              onChange={(e) => setReviewData({ ...reviewData, guestName: e.target.value })}
                              className="bg-white/5 border-white/10"
                            />
                            <Input
                              placeholder="Your Email"
                              type="email"
                              value={reviewData.guestEmail}
                              onChange={(e) => setReviewData({ ...reviewData, guestEmail: e.target.value })}
                              className="bg-white/5 border-white/10"
                            />
                          </>
                        )}
                        <div className="flex gap-2">
                          <Button
                            onClick={handleSubmitReview}
                            disabled={createReviewMutation.isPending}
                            className="flex-1 bg-red-600 hover:bg-red-700"
                          >
                            {createReviewMutation.isPending ? "Submitting..." : "Submit Review"}
                          </Button>
                          <Button
                            onClick={() => setShowReviewForm(false)}
                            variant="outline"
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Reviews List */}
                  <div className="space-y-3">
                    {reviews.length === 0 ? (
                      <div className="text-center py-8 text-white/40">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No reviews yet</p>
                      </div>
                    ) : (
                      reviews.map((review) => (
                        <Card key={review.id} className="p-4 bg-white/5 border-white/10">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="font-semibold">{review.title}</div>
                              <div className="text-sm text-white/60">{review.guestName || "Anonymous"}</div>
                            </div>
                            <div className="flex gap-1">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-4 h-4 ${
                                    i < review.rating
                                      ? "fill-yellow-500 text-yellow-500"
                                      : "text-white/20"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                          <p className="text-sm text-white/70">{review.reviewText}</p>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <MapIcon className="w-16 h-16 mx-auto mb-4 text-white/20" />
                  <p className="text-white/60 text-lg">Select a studio to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
