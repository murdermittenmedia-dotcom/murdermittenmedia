/* ============================================================
   FIND A STUDIO — Studio Directory
   Dark Editorial Theme matching Murder Mitten Media
   ============================================================ */

import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  MapPin, Plus, X, Star, Phone, Mail, Instagram, Music,
  Globe, Upload, Loader2, ArrowLeft,
} from "lucide-react";
import { Link } from "wouter";

export default function FindStudio() {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudio, setSelectedStudio] = useState<any>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    studioName: "",
    location: "",
    latitude: 0,
    longitude: 0,
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

  const { data: studios, refetch: refetchStudios } = trpc.studios.getAll.useQuery();
  const createStudioMutation = trpc.studios.create.useMutation({
    onSuccess: () => {
      toast.success("Studio added!");
      setFormData({
        studioName: "",
        location: "",
        latitude: 0,
        longitude: 0,
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
      setUploadedImages([]);
      setShowForm(false);
      refetchStudios();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to add studio");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.studioName.trim()) {
      toast.error("Studio name is required");
      return;
    }

    createStudioMutation.mutate({
      ...formData,
      engineers: formData.engineers || null,
      contactInfo: formData.contactInfo || null,
      instagramHandle: formData.instagramHandle || null,
      twitterHandle: formData.twitterHandle || null,
      facebookUrl: formData.facebookUrl || null,
      websiteUrl: formData.websiteUrl || null,
      youtubeChannel: formData.youtubeChannel || null,
      tiktokHandle: formData.tiktokHandle || null,
      description: formData.description || null,
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          setUploadedImages((prev) => [...prev, base64]);
        };
        reader.readAsDataURL(file);
      }
      toast.success("Images added");
    } catch (error) {
      toast.error("Failed to upload images");
    } finally {
      setIsUploading(false);
    }
  };

  const filteredStudios = studios?.filter((studio: any) =>
    studio.studioName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    studio.location?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const isAdmin = user?.role === "admin";

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* Header with Navigation */}
      <div className="border-b border-white/10 bg-[#080808]/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <ArrowLeft className="w-5 h-5 text-red-600" />
            <span className="font-['Anton'] text-lg tracking-wider">MURDER MITTEN</span>
          </Link>
          {isAdmin && (
            <Button
              onClick={() => setShowForm(!showForm)}
              className="bg-red-600 hover:bg-red-700 flex items-center gap-2 text-xs uppercase tracking-widest"
            >
              <Plus className="w-4 h-4" />
              Add Studio
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="mb-12">
          <h1 className="font-['Anton'] text-6xl md:text-7xl uppercase mb-4">
            Find A <span className="text-red-600">Studio</span>
          </h1>
          <p className="text-white/60 text-lg max-w-2xl">
            Discover recording studios and book engineers in Michigan. Connect with industry professionals.
          </p>
        </div>

        {/* Admin Form */}
        {isAdmin && showForm && (
          <div className="mb-16 border border-white/10 rounded-lg p-8 bg-white/[0.03]">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-['Anton'] text-3xl uppercase">Add New Studio</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Studio Name */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-white/60 mb-3">
                  Studio Name *
                </label>
                <Input
                  placeholder="e.g., Top Rank Studios"
                  value={formData.studioName}
                  onChange={(e) => setFormData({ ...formData, studioName: e.target.value })}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-white/60 mb-3">
                  Location (Address)
                </label>
                <Input
                  placeholder="Enter studio address"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
              </div>

              {/* Coordinates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-white/60 mb-3">
                    Latitude
                  </label>
                  <Input
                    type="number"
                    step="0.000001"
                    placeholder="42.331400"
                    value={formData.latitude || ""}
                    onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || 0 })}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest text-white/60 mb-3">
                    Longitude
                  </label>
                  <Input
                    type="number"
                    step="0.000001"
                    placeholder="-83.045833"
                    value={formData.longitude || ""}
                    onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || 0 })}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  />
                </div>
              </div>

              {/* Engineers */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-white/60 mb-3">
                  Engineers to Book With
                </label>
                <Textarea
                  placeholder="e.g., John Smith, Maria Garcia"
                  value={formData.engineers}
                  onChange={(e) => setFormData({ ...formData, engineers: e.target.value })}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-20"
                />
              </div>

              {/* Contact Info */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-white/60 mb-3">
                  Contact Info
                </label>
                <Input
                  placeholder="Phone or email"
                  value={formData.contactInfo}
                  onChange={(e) => setFormData({ ...formData, contactInfo: e.target.value })}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
              </div>

              {/* Social Media */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-white/60 mb-3">
                    Instagram
                  </label>
                  <Input
                    placeholder="@handle"
                    value={formData.instagramHandle}
                    onChange={(e) => setFormData({ ...formData, instagramHandle: e.target.value })}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest text-white/60 mb-3">
                    TikTok
                  </label>
                  <Input
                    placeholder="@handle"
                    value={formData.tiktokHandle}
                    onChange={(e) => setFormData({ ...formData, tiktokHandle: e.target.value })}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  />
                </div>
              </div>

              {/* Website */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-white/60 mb-3">
                  Website
                </label>
                <Input
                  placeholder="https://example.com"
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-white/60 mb-3">
                  Description
                </label>
                <Textarea
                  placeholder="Tell us about your studio..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-20"
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-white/60 mb-3">
                  Studio Images
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isUploading}
                  className="block w-full text-sm text-white/60 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-red-600 file:text-white hover:file:bg-red-700"
                />
                {uploadedImages.length > 0 && (
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {uploadedImages.map((img, idx) => (
                      <div key={idx} className="relative">
                        <img src={img} alt={`Studio ${idx}`} className="w-full h-20 object-cover rounded" />
                        <button
                          type="button"
                          onClick={() => setUploadedImages((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 bg-red-600 p-1 rounded hover:bg-red-700"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="submit"
                  disabled={createStudioMutation.isPending}
                  className="bg-red-600 hover:bg-red-700 flex items-center gap-2 uppercase tracking-widest text-xs"
                >
                  {createStudioMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Add Studio
                </Button>
                <Button
                  type="button"
                  onClick={() => setShowForm(false)}
                  variant="outline"
                  className="uppercase tracking-widest text-xs"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Search */}
        <div className="mb-12">
          <Input
            placeholder="Search studios by name or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 py-3"
          />
        </div>

        {/* Studio Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStudios.map((studio: any) => (
            <div
              key={studio.id}
              onClick={() => setSelectedStudio(studio)}
              className="border border-white/10 bg-white/[0.03] hover:border-red-600/50 hover:bg-white/[0.06] transition-all duration-300 p-6 cursor-pointer group"
            >
              <h3 className="font-['Anton'] text-xl uppercase mb-3 group-hover:text-red-600 transition-colors">
                {studio.studioName}
              </h3>
              
              {studio.location && (
                <p className="text-white/60 text-sm flex items-center gap-2 mb-4">
                  <MapPin className="w-4 h-4 text-red-600" /> {studio.location}
                </p>
              )}

              {studio.engineers && (
                <p className="text-white/50 text-xs mb-4 line-clamp-2">
                  <span className="text-white/70 font-medium">Engineers:</span> {studio.engineers}
                </p>
              )}

              {studio.averageRating > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3 h-3 ${i < Math.round(studio.averageRating) ? "fill-yellow-400 text-yellow-400" : "text-white/20"}`}
                    />
                  ))}
                  <span className="text-xs text-white/60">({studio.reviewCount})</span>
                </div>
              )}

              {studio.contactInfo && (
                <p className="text-xs text-white/50 flex items-center gap-2">
                  <Phone className="w-3 h-3" /> {studio.contactInfo}
                </p>
              )}
            </div>
          ))}
        </div>

        {filteredStudios.length === 0 && (
          <div className="text-center py-12">
            <p className="text-white/60 text-lg">No studios found. Check back soon!</p>
          </div>
        )}
      </div>
    </div>
  );
}
