/* ============================================================
   FIND A STUDIO — Studio Directory with Google Maps
   ============================================================ */

import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Map } from "@/components/Map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  MapPin, Plus, X, Star, Phone, Mail, Instagram, Music,
  Globe, MessageSquare, Upload, Loader2,
} from "lucide-react";

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
    
    // Only require studio name
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

  const isAdmin = user?.role === "admin";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#1a0a0a] to-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold flex items-center gap-3">
              <MapPin className="w-8 h-8 text-red-600" />
              Find A Studio
            </h1>
            <p className="text-white/60 mt-1">Discover recording studios and book engineers</p>
          </div>
          {isAdmin && (
            <Button
              onClick={() => setShowForm(!showForm)}
              className="bg-red-600 hover:bg-red-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Studio
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Admin Form */}
        {isAdmin && showForm && (
          <div className="mb-8 border border-white/10 rounded-lg p-6 bg-white/5">
            <h2 className="text-2xl font-bold mb-6">Add New Studio</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Studio Name */}
              <div>
                <label className="block text-sm font-medium mb-2">Studio Name *</label>
                <Input
                  placeholder="e.g., Top Rank Studios"
                  value={formData.studioName}
                  onChange={(e) => setFormData({ ...formData, studioName: e.target.value })}
                  className="bg-white/10 border-white/20"
                />
              </div>

              {/* Location with Google Maps */}
              <div>
                <label className="block text-sm font-medium mb-2">Location (Address)</label>
                <Input
                  placeholder="Enter studio address"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="bg-white/10 border-white/20"
                />
                <p className="text-xs text-white/40 mt-1">Coordinates will auto-populate from map</p>
              </div>

              {/* Map Preview */}
              {formData.location && (
                <div className="h-64 rounded-lg overflow-hidden border border-white/10">
                  <Map
                    onMapReady={(map) => {
                      // Auto-center on location when address is entered
                      const geocoder = new google.maps.Geocoder();
                      geocoder.geocode({ address: formData.location }, (results, status) => {
                        if (status === "OK" && results?.[0]) {
                          const { lat, lng } = results[0].geometry.location;
                          map.setCenter({ lat: lat(), lng: lng() });
                          map.setZoom(15);
                          setFormData((prev) => ({
                            ...prev,
                            latitude: lat(),
                            longitude: lng(),
                          }));
                        }
                      });
                    }}
                  />
                </div>
              )}

              {/* Coordinates Display */}
              {formData.latitude !== 0 && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-white/5 p-3 rounded border border-white/10">
                    <p className="text-white/60">Latitude</p>
                    <p className="font-mono">{formData.latitude.toFixed(6)}</p>
                  </div>
                  <div className="bg-white/5 p-3 rounded border border-white/10">
                    <p className="text-white/60">Longitude</p>
                    <p className="font-mono">{formData.longitude.toFixed(6)}</p>
                  </div>
                </div>
              )}

              {/* Engineers */}
              <div>
                <label className="block text-sm font-medium mb-2">Engineers to Book With</label>
                <Textarea
                  placeholder="e.g., John Smith, Maria Garcia"
                  value={formData.engineers}
                  onChange={(e) => setFormData({ ...formData, engineers: e.target.value })}
                  className="bg-white/10 border-white/20 h-20"
                />
              </div>

              {/* Contact Info */}
              <div>
                <label className="block text-sm font-medium mb-2">Contact Info</label>
                <Input
                  placeholder="Phone or email"
                  value={formData.contactInfo}
                  onChange={(e) => setFormData({ ...formData, contactInfo: e.target.value })}
                  className="bg-white/10 border-white/20"
                />
              </div>

              {/* Social Media */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                    <Instagram className="w-4 h-4" /> Instagram
                  </label>
                  <Input
                    placeholder="@handle"
                    value={formData.instagramHandle}
                    onChange={(e) => setFormData({ ...formData, instagramHandle: e.target.value })}
                    className="bg-white/10 border-white/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                    <Music className="w-4 h-4" /> TikTok
                  </label>
                  <Input
                    placeholder="@handle"
                    value={formData.tiktokHandle}
                    onChange={(e) => setFormData({ ...formData, tiktokHandle: e.target.value })}
                    className="bg-white/10 border-white/20"
                  />
                </div>
              </div>

              {/* Website */}
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Globe className="w-4 h-4" /> Website
                </label>
                <Input
                  placeholder="https://example.com"
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                  className="bg-white/10 border-white/20"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <Textarea
                  placeholder="Tell us about your studio..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-white/10 border-white/20 h-20"
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Upload className="w-4 h-4" /> Studio Images
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
                          className="absolute top-1 right-1 bg-red-600 p-1 rounded"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit */}
              <div className="flex gap-4">
                <Button
                  type="submit"
                  disabled={createStudioMutation.isPending}
                  className="bg-red-600 hover:bg-red-700 flex items-center gap-2"
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
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Studio List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {studios?.map((studio: any) => (
            <div
              key={studio.id}
              onClick={() => setSelectedStudio(studio)}
              className="border border-white/10 rounded-lg p-6 hover:border-red-600/50 hover:bg-white/5 transition-all cursor-pointer"
            >
              <h3 className="text-xl font-bold mb-2">{studio.studioName}</h3>
              {studio.location && (
                <p className="text-white/60 text-sm flex items-center gap-2 mb-4">
                  <MapPin className="w-4 h-4" /> {studio.location}
                </p>
              )}
              {studio.averageRating > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${i < Math.round(studio.averageRating) ? "fill-yellow-400 text-yellow-400" : "text-white/20"}`}
                    />
                  ))}
                  <span className="text-sm text-white/60">({studio.reviewCount})</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
