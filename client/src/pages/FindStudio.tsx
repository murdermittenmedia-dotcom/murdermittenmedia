import { useState } from "react";
import { MapPin, Phone, Mail, Instagram, Twitter, Facebook, Youtube, Music, Star, MessageSquare, Plus, Edit2, Trash2, X } from "lucide-react";
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
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [showEngineersForm, setShowEngineersForm] = useState(false);
  const [editingStudio, setEditingStudio] = useState<number | null>(null);
  const [newEngineer, setNewEngineer] = useState("");
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
      setEditingStudio(null);
      refetchStudios();
      alert("Studio saved successfully!");
    },
    onError: (error) => {
      alert(`Error: ${error.message}`);
    },
  });

  const deleteStudioMutation = trpc.studios.delete.useMutation({
    onSuccess: () => {
      setSelectedStudio(null);
      refetchStudios();
      alert("Studio deleted successfully!");
    },
    onError: (error) => {
      alert(`Error: ${error.message}`);
    },
  });

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

  const studioListingCheckoutMutation = trpc.stripe.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, "_blank");
      } else {
        alert("Error: No checkout URL returned");
      }
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

  const handleAdminFormSubmit = () => {
    if (!adminFormData.studioName.trim()) {
      alert("Please enter a studio name");
      return;
    }
    createStudioMutation.mutate(adminFormData as any);
  };

  const handleEditStudio = (studio: any) => {
    setAdminFormData({
      studioName: studio.studioName,
      location: studio.location || "",
      latitude: studio.latitude || "",
      longitude: studio.longitude || "",
      engineers: studio.engineers || "",
      contactInfo: studio.contactInfo || "",
      instagramHandle: studio.instagramHandle || "",
      twitterHandle: studio.twitterHandle || "",
      facebookUrl: studio.facebookUrl || "",
      websiteUrl: studio.websiteUrl || "",
      youtubeChannel: studio.youtubeChannel || "",
      tiktokHandle: studio.tiktokHandle || "",
      description: studio.description || "",
    });
    setEditingStudio(studio.id);
    setShowAdminForm(true);
  };

  const handleAddEngineer = () => {
    if (!newEngineer.trim() || !currentStudio) return;
    const engineers = currentStudio.engineers ? currentStudio.engineers.split(", ") : [];
    if (!engineers.includes(newEngineer.trim())) {
      engineers.push(newEngineer.trim());
      const updatedEngineers = engineers.join(", ");
      setAdminFormData({
        ...adminFormData,
        engineers: updatedEngineers,
      });
      createStudioMutation.mutate({
        ...adminFormData,
        engineers: updatedEngineers,
      } as any);
      setNewEngineer("");
    }
  };

  const handleRemoveEngineer = (engineerName: string) => {
    if (!currentStudio) return;
    const engineers = currentStudio.engineers ? currentStudio.engineers.split(", ") : [];
    const filtered = engineers.filter((e) => e !== engineerName);
    const updatedEngineers = filtered.join(", ");
    setAdminFormData({
      ...adminFormData,
      engineers: updatedEngineers,
    });
    createStudioMutation.mutate({
      ...adminFormData,
      engineers: updatedEngineers,
    } as any);
  };

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
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl md:text-5xl font-['Anton'] mb-2">Find A Studio</h1>
            <p className="text-white/60">Discover recording studios and book engineers in Michigan</p>
          </div>
          {user?.role === "admin" ? (
            <Button
              onClick={() => {
                setShowAdminForm(!showAdminForm);
                setEditingStudio(null);
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
              }}
              className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Studio
            </Button>
          ) : user ? (
            <Button
              onClick={() => {
                studioListingCheckoutMutation.mutate({
                  packageId: "studio-listing",
                });
              }}
              disabled={studioListingCheckoutMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
            >
              {studioListingCheckoutMutation.isPending ? "Loading..." : "Get Your Studio Listed"}
            </Button>
          ) : null}
        </div>

        {/* Non-Admin CTA */}
        {!user?.role && user && (
          <Card className="bg-red-600/10 border border-red-600/50 p-8 mb-8 text-center">
            <h2 className="text-3xl font-bold mb-3">Get Your Studio Listed</h2>
            <p className="text-white/80 mb-6">Reach more artists and engineers. Only $19.99/month</p>
            <Button
              onClick={() => {
                studioListingCheckoutMutation.mutate({
                  packageId: "studio-listing",
                });
              }}
              disabled={studioListingCheckoutMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white text-lg px-8 py-3"
            >
              {studioListingCheckoutMutation.isPending ? "Loading..." : "Subscribe Now - $19.99/month"}
            </Button>
          </Card>
        )}

        {/* Admin Form - Simplified */}
        {user?.role === "admin" && showAdminForm && (
          <Card className="bg-white/5 border-white/10 p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4">{editingStudio ? "Edit Studio" : "Add New Studio"}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                placeholder="Studio Name"
                value={adminFormData.studioName}
                onChange={(e) => setAdminFormData({ ...adminFormData, studioName: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
              />
              <Input
                placeholder="Location (Address)"
                value={adminFormData.location}
                onChange={(e) => setAdminFormData({ ...adminFormData, location: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
              />
              <Input
                placeholder="Latitude"
                value={adminFormData.latitude}
                onChange={(e) => setAdminFormData({ ...adminFormData, latitude: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
              />
              <Input
                placeholder="Longitude"
                value={adminFormData.longitude}
                onChange={(e) => setAdminFormData({ ...adminFormData, longitude: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
              />
              <Input
                placeholder="Contact Info (Phone/Email)"
                value={adminFormData.contactInfo}
                onChange={(e) => setAdminFormData({ ...adminFormData, contactInfo: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
              />
              <Input
                placeholder="Instagram Handle"
                value={adminFormData.instagramHandle}
                onChange={(e) => setAdminFormData({ ...adminFormData, instagramHandle: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
              />
              <Input
                placeholder="Twitter Handle"
                value={adminFormData.twitterHandle}
                onChange={(e) => setAdminFormData({ ...adminFormData, twitterHandle: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
              />
              <Input
                placeholder="Facebook URL"
                value={adminFormData.facebookUrl}
                onChange={(e) => setAdminFormData({ ...adminFormData, facebookUrl: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
              />
              <Input
                placeholder="Website URL"
                value={adminFormData.websiteUrl}
                onChange={(e) => setAdminFormData({ ...adminFormData, websiteUrl: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
              />
              <Input
                placeholder="YouTube Channel"
                value={adminFormData.youtubeChannel}
                onChange={(e) => setAdminFormData({ ...adminFormData, youtubeChannel: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
              />
              <Input
                placeholder="TikTok Handle"
                value={adminFormData.tiktokHandle}
                onChange={(e) => setAdminFormData({ ...adminFormData, tiktokHandle: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
              />
              <Textarea
                placeholder="Studio Description"
                value={adminFormData.description}
                onChange={(e) => setAdminFormData({ ...adminFormData, description: e.target.value })}
                className="bg-white/5 border-white/10 text-white col-span-full"
                rows={3}
              />
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                onClick={handleAdminFormSubmit}
                disabled={createStudioMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {createStudioMutation.isPending ? "Saving..." : "Save Studio"}
              </Button>
              <Button
                onClick={() => {
                  setShowAdminForm(false);
                  setEditingStudio(null);
                }}
                className="bg-white/10 hover:bg-white/20 text-white"
              >
                Cancel
              </Button>
            </div>
          </Card>
        )}

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
                      setShowEngineersForm(false);
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
                      {studio.location || "No location"}
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
                  <div className="flex items-start justify-between mb-4">
                    <h2 className="text-2xl font-bold">{currentStudio.studioName}</h2>
                    {user?.role === "admin" && (
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleEditStudio(currentStudio)}
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this studio?")) {
                              deleteStudioMutation.mutate({ id: currentStudio.id });
                            }
                          }}
                          size="sm"
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {currentStudio.description && (
                    <p className="text-white/80 mb-4">{currentStudio.description}</p>
                  )}

                  {/* Location */}
                  {currentStudio.location && (
                    <div className="flex items-start gap-3 mb-4">
                      <MapPin className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-semibold">Location</div>
                        <div className="text-white/60">{currentStudio.location}</div>
                      </div>
                    </div>
                  )}

                  {/* Contact */}
                  {currentStudio.contactInfo && (
                    <div className="flex items-start gap-3 mb-4">
                      <Phone className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-semibold">Contact</div>
                        <div className="text-white/60">{currentStudio.contactInfo}</div>
                      </div>
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

                {/* Engineers Management */}
                {user?.role === "admin" && (
                  <Card className="bg-white/5 border-white/10 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold">Engineers</h3>
                      <Button
                        onClick={() => setShowEngineersForm(!showEngineersForm)}
                        className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
                        size="sm"
                      >
                        <Plus className="w-4 h-4" />
                        Add Engineer
                      </Button>
                    </div>

                    {showEngineersForm && (
                      <div className="flex gap-2 mb-4">
                        <Input
                          placeholder="Engineer name"
                          value={newEngineer}
                          onChange={(e) => setNewEngineer(e.target.value)}
                          className="bg-white/5 border-white/10 text-white"
                        />
                        <Button
                          onClick={handleAddEngineer}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          Add
                        </Button>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {currentStudio.engineers
                        ? currentStudio.engineers.split(", ").map((engineer) => (
                            <div
                              key={engineer}
                              className="bg-red-600/20 border border-red-600/50 rounded-full px-3 py-1 flex items-center gap-2 text-sm"
                            >
                              {engineer}
                              <button
                                onClick={() => handleRemoveEngineer(engineer)}
                                className="hover:text-red-400 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))
                        : <div className="text-white/40 text-sm">No engineers added yet</div>}
                    </div>
                  </Card>
                )}

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
