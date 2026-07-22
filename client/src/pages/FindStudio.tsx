/* ============================================================
   FIND A STUDIO — Studio Directory with IPStack Geolocation
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
  Globe, Upload, Loader2, ArrowLeft, Search, Image as ImageIcon,
} from "lucide-react";
import { Link } from "wouter";
import { SiteNav } from "@/components/SiteNav";

const IPSTACK_API_KEY = "4e752c114b52090fa0e7ad236ea145e1";

// Michigan cities with coordinates for quick selection
const MICHIGAN_CITIES = [
  { city: "Detroit, Michigan", lat: "42.3314", lng: "-83.0458" },
  { city: "Ann Arbor, Michigan", lat: "42.2808", lng: "-83.7430" },
  { city: "Lansing, Michigan", lat: "42.7335", lng: "-84.5555" },
  { city: "Grand Rapids, Michigan", lat: "42.9633", lng: "-85.6789" },
  { city: "Flint, Michigan", lat: "43.0125", lng: "-83.6875" },
  { city: "Dearborn, Michigan", lat: "42.3222", lng: "-83.1763" },
  { city: "Ypsilanti, Michigan", lat: "42.2411", lng: "-83.6137" },
  { city: "Pontiac, Michigan", lat: "42.6386", lng: "-83.2900" },
  { city: "Kalamazoo, Michigan", lat: "42.2917", lng: "-85.5872" },
  { city: "Saginaw, Michigan", lat: "43.4167", lng: "-83.9500" },
  { city: "Sterling Heights, Michigan", lat: "42.5833", lng: "-83.0333" },
  { city: "Livonia, Michigan", lat: "42.3667", lng: "-83.3667" },
  { city: "Warren, Michigan", lat: "42.5167", lng: "-83.0167" },
  { city: "Westland, Michigan", lat: "42.3167", lng: "-83.4000" },
  { city: "Farmington Hills, Michigan", lat: "42.4833", lng: "-83.4667" },
];

export default function FindStudio() {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudio, setSelectedStudio] = useState<any>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);

  // Form state
  const [formData, setFormData] = useState({
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

  const { data: studios, refetch: refetchStudios } = trpc.studios.getAll.useQuery();
  const createStudioMutation = trpc.studios.create.useMutation({
    onSuccess: () => {
      toast.success("Studio added!");
      setFormData({
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
      setUploadedImages([]);
      setShowForm(false);
      setLocationSuggestions([]);
      refetchStudios();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to add studio");
    },
  });

  const handleLocationInput = async (value: string) => {
    setFormData({ ...formData, location: value });
    
    if (value.length > 2) {
      try {
        // Use OpenCage Geocoding API (free alternative to IPStack for geocoding)
        // For now, use a simple approach: geocode via nominatim (free, open-source)
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=json&limit=5`
        );
        
        if (response.ok) {
          const results = await response.json();
          if (results.length > 0) {
            const suggestions = results.map((result: any) => ({
              city: result.display_name,
              lat: result.lat,
              lng: result.lon,
            }));
            setLocationSuggestions(suggestions);
          } else {
            setLocationSuggestions([]);
          }
        } else {
          setLocationSuggestions([]);
        }
      } catch (error) {
        console.error("Geocoding error:", error);
        setLocationSuggestions([]);
      }
    } else {
      setLocationSuggestions([]);
    }
  };

  const handleLocationSelect = (city: any) => {
    setFormData({
      ...formData,
      location: city.city,
      latitude: String(city.lat),
      longitude: String(city.lng),
    });
    setLocationSuggestions([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.studioName.trim()) {
      toast.error("Studio name is required");
      return;
    }

    createStudioMutation.mutate({
      studioName: formData.studioName,
      location: formData.location || "",
      latitude: formData.latitude || "",
      longitude: formData.longitude || "",
      engineers: formData.engineers || null,
      contactInfo: formData.contactInfo || null,
      instagramHandle: formData.instagramHandle || null,
      twitterHandle: formData.twitterHandle || null,
      facebookUrl: formData.facebookUrl || null,
      websiteUrl: formData.websiteUrl || null,
      youtubeChannel: formData.youtubeChannel || null,
      tiktokHandle: formData.tiktokHandle || null,
      description: formData.description || null,
      imageUrl: uploadedImages[0] || null,
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formDataObj = new FormData();
        formDataObj.append("file", file);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formDataObj,
        });

        if (response.ok) {
          const data = await response.json();
          setUploadedImages([...uploadedImages, data.url]);
          toast.success("Image uploaded!");
        } else {
          toast.error("Failed to upload image");
        }
      }
    } finally {
      setIsUploading(false);
    }
  };

  const isAdmin = user?.role === "admin";
  const filteredStudios = studios?.filter(s =>
    s.studioName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.location.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <SiteNav />

      {/* Header */}
      <div className="border-b border-white/10 bg-gradient-to-b from-white/5 to-transparent py-12">
        <div className="container max-w-5xl mx-auto px-4">
          <Link href="/">
            <a className="inline-flex items-center gap-2 text-white/40 hover:text-white mb-6 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </a>
          </Link>
          <h1 className="font-['Anton'] text-5xl md:text-6xl uppercase mb-3">
            Find A <span className="text-red-600">Studio</span>
          </h1>
          <p className="text-white/60 text-lg">Discover recording studios and book engineers in Michigan</p>
        </div>
      </div>

      <div className="container max-w-5xl mx-auto px-4 py-12">
        {/* Admin Add Studio Button */}
        {isAdmin && (
          <div className="mb-8">
            <Button
              onClick={() => setShowForm(!showForm)}
              className="bg-red-600 hover:bg-red-700 text-white uppercase tracking-widest font-bold"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Studio
            </Button>
          </div>
        )}

        {/* Add Studio Form */}
        {isAdmin && showForm && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-12">
            <h2 className="font-['Anton'] text-3xl uppercase mb-6">Add New Studio</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Studio Name */}
              <div>
                <label className="text-sm uppercase tracking-widest text-white/60 mb-2 block">
                  Studio Name *
                </label>
                <Input
                  value={formData.studioName}
                  onChange={(e) => setFormData({ ...formData, studioName: e.target.value })}
                  placeholder="Enter studio name"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>

              {/* Location with Suggestions */}
              <div>
                <label className="text-sm uppercase tracking-widest text-white/60 mb-2 block">
                  Location
                </label>
                <div className="relative">
                  <Input
                    value={formData.location}
                    onChange={(e) => handleLocationInput(e.target.value)}
                    placeholder="Enter full address (e.g., 123 Main St, Detroit, MI 48201)..."
                    className="bg-white/5 border-white/10 text-white"
                  />
                  {locationSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-[#1a1a1a] border border-white/10 rounded-lg mt-1 z-50 max-h-48 overflow-y-auto">
                      {locationSuggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleLocationSelect(suggestion)}
                          className="w-full text-left px-4 py-2 hover:bg-white/10 transition-colors text-sm text-white/80"
                        >
                          {suggestion.city}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Coordinates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm uppercase tracking-widest text-white/60 mb-2 block">
                    Latitude
                  </label>
                  <Input
                    value={formData.latitude}
                    readOnly
                    placeholder="Auto-filled"
                    className="bg-white/5 border-white/10 text-white/50"
                  />
                </div>
                <div>
                  <label className="text-sm uppercase tracking-widest text-white/60 mb-2 block">
                    Longitude
                  </label>
                  <Input
                    value={formData.longitude}
                    readOnly
                    placeholder="Auto-filled"
                    className="bg-white/5 border-white/10 text-white/50"
                  />
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <label className="text-sm uppercase tracking-widest text-white/60 mb-2 block">
                  Contact Info
                </label>
                <Input
                  value={formData.contactInfo}
                  onChange={(e) => setFormData({ ...formData, contactInfo: e.target.value })}
                  placeholder="Phone, email, etc."
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>

              {/* Social Media */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  value={formData.instagramHandle}
                  onChange={(e) => setFormData({ ...formData, instagramHandle: e.target.value })}
                  placeholder="Instagram Handle"
                  className="bg-white/5 border-white/10 text-white"
                />
                <Input
                  value={formData.twitterHandle}
                  onChange={(e) => setFormData({ ...formData, twitterHandle: e.target.value })}
                  placeholder="Twitter Handle"
                  className="bg-white/5 border-white/10 text-white"
                />
                <Input
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                  placeholder="Website URL"
                  className="bg-white/5 border-white/10 text-white"
                />
                <Input
                  value={formData.youtubeChannel}
                  onChange={(e) => setFormData({ ...formData, youtubeChannel: e.target.value })}
                  placeholder="YouTube Channel"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="text-sm uppercase tracking-widest text-white/60 mb-2 block">
                  Studio Images
                </label>
                <div className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center hover:border-white/40 transition-colors">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={isUploading}
                    className="hidden"
                    id="image-upload"
                  />
                  <label htmlFor="image-upload" className="cursor-pointer">
                    <ImageIcon className="w-8 h-8 mx-auto mb-2 text-white/40" />
                    <p className="text-white/60 text-sm">Click to upload images</p>
                  </label>
                </div>
                {uploadedImages.length > 0 && (
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {uploadedImages.map((img, idx) => (
                      <div key={idx} className="relative">
                        <img src={img} alt="Studio" className="w-full h-24 object-cover rounded" />
                        <button
                          type="button"
                          onClick={() => setUploadedImages(uploadedImages.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 bg-red-600 p-1 rounded"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="text-sm uppercase tracking-widest text-white/60 mb-2 block">
                  Description
                </label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Studio description..."
                  className="bg-white/5 border-white/10 text-white min-h-24"
                />
              </div>

              {/* Submit */}
              <div className="flex gap-4">
                <Button
                  type="submit"
                  disabled={createStudioMutation.isPending || isUploading}
                  className="bg-red-600 hover:bg-red-700 text-white uppercase tracking-widest font-bold"
                >
                  {createStudioMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Studio"
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={() => setShowForm(false)}
                  variant="outline"
                  className="text-white border-white/20 hover:bg-white/5"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Search */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-white/40" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search studios by name or location..."
              className="pl-10 bg-white/5 border-white/10 text-white"
            />
          </div>
        </div>

        {/* Studios Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {filteredStudios.length > 0 ? (
            filteredStudios.map((studio) => (
              <div
                key={studio.id}
                onClick={() => setSelectedStudio(studio)}
                className="bg-white/5 border border-white/10 rounded-lg p-6 hover:border-red-600/50 cursor-pointer transition-all group"
              >
                {studio.imageUrl && (
                  <img src={studio.imageUrl} alt={studio.studioName} className="w-full h-32 object-cover rounded mb-4" />
                )}
                <h3 className="font-['Anton'] text-xl uppercase mb-2 group-hover:text-red-500 transition-colors">
                  {studio.studioName}
                </h3>
                {studio.location && (
                  <p className="text-white/60 text-sm flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4" />
                    {studio.location}
                  </p>
                )}
                {studio.averageRating && (
                  <div className="flex items-center gap-1 text-yellow-500 text-sm">
                    <Star className="w-4 h-4 fill-yellow-500" />
                    {studio.averageRating} ({studio.reviewCount} reviews)
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-white/40 col-span-full text-center py-12">No studios found</p>
          )}
        </div>

        {/* Studio Detail */}
        {selectedStudio && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-8">
                <button
                  onClick={() => setSelectedStudio(null)}
                  className="float-right text-white/40 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
                <h2 className="font-['Anton'] text-3xl uppercase mb-4">{selectedStudio.studioName}</h2>
                {selectedStudio.imageUrl && (
                  <img src={selectedStudio.imageUrl} alt={selectedStudio.studioName} className="w-full h-48 object-cover rounded mb-4" />
                )}
                <div className="space-y-3 text-white/80">
                  {selectedStudio.location && <p><MapPin className="w-4 h-4 inline mr-2" />{selectedStudio.location}</p>}
                  {selectedStudio.contactInfo && <p><Phone className="w-4 h-4 inline mr-2" />{selectedStudio.contactInfo}</p>}
                  {selectedStudio.description && <p className="mt-4">{selectedStudio.description}</p>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
