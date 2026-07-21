import { useState, useEffect } from "react";
import { Newspaper, Calendar, Heart, MessageCircle, Share2, Search, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";

export default function News() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<number | null>(null);

  const { data: articles = [] } = trpc.news.getAllArticles.useQuery();
  const filteredArticles = articles.filter(
    (a) =>
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.caption.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedArticleData = articles.find((a) => a.id === selectedArticle);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#080808] via-[#0a0a0a] to-[#080808] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/40 backdrop-blur-sm sticky top-0 z-40">
        <div className="container py-8">
          <div className="flex items-center gap-3 mb-6">
            <Newspaper className="w-8 h-8 text-red-600" />
            <h1 className="text-4xl font-bold">LATEST NEWS</h1>
          </div>
          <p className="text-white/60 max-w-2xl">Breaking stories from the Murder Mitten Media team. Industry insights, artist spotlights, and exclusive content.</p>
        </div>
      </div>

      <div className="container py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Article List */}
          <div className="lg:col-span-1">
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-white/40" />
                <Input
                  placeholder="Search articles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                />
              </div>

              {/* Article List */}
              <div className="space-y-2 max-h-[700px] overflow-y-auto">
                {filteredArticles.length === 0 ? (
                  <div className="text-center py-8 text-white/40">
                    <Newspaper className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No articles found</p>
                  </div>
                ) : (
                  filteredArticles.map((article) => (
                    <button
                      key={article.id}
                      onClick={() => setSelectedArticle(article.id)}
                      className={`w-full text-left p-4 rounded-lg border transition-all group ${
                        selectedArticle === article.id
                          ? "bg-red-600/20 border-red-600"
                          : "bg-white/5 border-white/10 hover:border-white/20"
                      }`}
                    >
                      {article.thumbnailUrl && (
                        <div className="w-full h-24 bg-white/5 rounded mb-3 overflow-hidden">
                          <img
                            src={article.thumbnailUrl}
                            alt={article.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                      )}
                      <div className="font-semibold text-sm line-clamp-2">{article.title}</div>
                      <div className="text-xs text-white/60 flex items-center gap-1 mt-2">
                        <Calendar className="w-3 h-3" />
                        {new Date(article.publishedAt).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-white/40 mt-1 line-clamp-1">{article.caption}</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Article Details */}
          <div className="lg:col-span-2">
            {selectedArticleData ? (
              <div className="space-y-6">
                {/* Article Header */}
                <Card className="p-8 bg-gradient-to-br from-white/10 to-white/5 border-white/10">
                  {selectedArticleData.thumbnailUrl && (
                    <div className="w-full h-96 bg-white/5 rounded-lg overflow-hidden mb-6">
                      <img
                        src={selectedArticleData.thumbnailUrl}
                        alt={selectedArticleData.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="mb-4">
                    <div className="flex items-center gap-2 text-red-600 text-sm font-semibold mb-2">
                      <TrendingUp className="w-4 h-4" />
                      FEATURED ARTICLE
                    </div>
                    <h1 className="text-4xl font-bold mb-4">{selectedArticleData.title}</h1>
                    <div className="flex items-center gap-4 text-white/60 text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(selectedArticleData.publishedAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </div>
                      {selectedArticleData.metaDescription && (
                        <div className="flex items-center gap-1">
                          <Newspaper className="w-4 h-4" />
                          {selectedArticleData.metaDescription}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SEO Meta Tags */}
                  {selectedArticleData.metaKeywords && (
                    <div className="mb-6 pt-6 border-t border-white/10">
                      <div className="text-xs text-white/60 uppercase tracking-wider mb-2">Keywords</div>
                      <div className="flex flex-wrap gap-2">
                        {selectedArticleData.metaKeywords.split(",").map((keyword) => (
                          <span key={keyword} className="px-3 py-1 bg-white/10 rounded-full text-xs">
                            {keyword.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>

                {/* Article Content */}
                <Card className="p-8 bg-white/5 border-white/10">
                  <div className="prose prose-invert max-w-none">
                    <Streamdown>{selectedArticleData.caption}</Streamdown>
                  </div>
                </Card>

                {/* Social Sharing */}
                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      const url = `${window.location.origin}/news?article=${selectedArticleData.id}`;
                      navigator.clipboard.writeText(url);
                    }}
                    className="flex-1 bg-white/10 hover:bg-white/20"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share Article
                  </Button>
                  <Button className="flex-1 bg-red-600 hover:bg-red-700">
                    <Heart className="w-4 h-4 mr-2" />
                    Save Article
                  </Button>
                </div>

                {/* Related Articles */}
                {filteredArticles.length > 1 && (
                  <div>
                    <h3 className="text-xl font-bold mb-4">More Articles</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {filteredArticles
                        .filter((a) => a.id !== selectedArticleData.id)
                        .slice(0, 4)
                        .map((article) => (
                          <button
                            key={article.id}
                            onClick={() => setSelectedArticle(article.id)}
                            className="text-left p-3 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-all group"
                          >
                            {article.thumbnailUrl && (
                              <div className="w-full h-32 bg-white/5 rounded mb-3 overflow-hidden">
                                <img
                                  src={article.thumbnailUrl}
                                  alt={article.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                              </div>
                            )}
                            <div className="font-semibold text-sm line-clamp-2">{article.title}</div>
                            <div className="text-xs text-white/60 mt-2">
                              {new Date(article.publishedAt).toLocaleDateString()}
                            </div>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <Newspaper className="w-16 h-16 mx-auto mb-4 text-white/20" />
                  <p className="text-white/60 text-lg">Select an article to read</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
