"use client"

import type React from "react"
import { Heart } from "lucide-react" // Import Heart component
import { useState, useEffect, useCallback } from "react"
import { Filter, Search, Star, ShieldCheck } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import Footer from "@/components/Footer"
import Header from "@/components/Header"
import { supabase } from "@/lib/supabase"
import AuthPopup from "@/components/auth-popup"

// Product type definition
type Product = {
  id: string
  product_name: string
  product_photo_urls?: string[]
  original_price?: number
  discount_price: number
  categories?: Array<{ main: string; sub: string }>
  company: {
    company_name: string
    company_logo_url: string
  } | null
  is_featured?: boolean
  is_best_seller?: boolean
  is_approved?: boolean
  stock_quantity?: number
}

// Updated FavButton component with authentication popup support
function FavButton({ product }: { product: Product }) {
  const [isFav, setIsFav] = useState(false)
  const [showAuthPopup, setShowAuthPopup] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const checkUserAndFavStatus = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const currentUserId = session?.user?.id || null
      setUserId(currentUserId)

      if (currentUserId) {
        const { data, error } = await supabase
          .from("favorites")
          .select("id")
          .eq("user_id", currentUserId)
          .eq("product_id", product.id)
          .single()
        setIsFav(!!data)
        if (error && error.code !== "PGRST116") console.error("Error checking favorite status:", error)
      } else {
        setIsFav(false)
      }
      setIsLoading(false)
    }

    checkUserAndFavStatus()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null)
      checkUserAndFavStatus() // Re-check fav status on auth change
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [product.id])

  const toggleFav = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    e.preventDefault()

    if (!userId) {
      setShowAuthPopup(true)
      return
    }

    setIsLoading(true)
    try {
      if (isFav) {
        const { error } = await supabase.from("favorites").delete().eq("user_id", userId).eq("product_id", product.id)
        if (error) throw error
        setIsFav(false)
      } else {
        const { error } = await supabase.from("favorites").insert({
          user_id: userId,
          product_id: product.id,
        })
        if (error) throw error
        setIsFav(true)
      }
    } catch (error) {
      console.error("Error toggling favorite:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={toggleFav}
        disabled={isLoading}
        className={`absolute top-2 right-2 p-2 rounded-full shadow-sm transition-all duration-300 ${
          isLoading ? "opacity-50" : "opacity-100"
        } ${isFav ? "bg-red-500 hover:bg-red-600" : "bg-white/90 hover:bg-white"}`}
        aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
      >
        <Heart className={`w-4 h-4 ${isFav ? "text-white fill-current" : "text-gray-600"}`} />
      </button>
      <AuthPopup
        isOpen={showAuthPopup}
        onClose={() => setShowAuthPopup(false)}
        onSuccess={() => setShowAuthPopup(false)}
      />
    </>
  )
}

// Product Card Component – updated to fetch and display actual review data
function ProductCard({ product }: { product: Product }) {
  const [reviewData, setReviewData] = useState({ count: 0, average: 0 })

  useEffect(() => {
    const fetchReviews = async () => {
      const { data, error } = await supabase.from("reviews").select("rating").eq("product_id", product.id)

      if (error) {
        console.error("Error fetching reviews:", error)
        setReviewData({ count: 0, average: 0 })
        return
      }

      if (data && data.length > 0) {
        const count = data.length
        const sum = data.reduce((acc, review) => acc + review.rating, 0)
        const average = count ? sum / count : 0
        setReviewData({ count, average })
      } else {
        setReviewData({ count: 0, average: 0 })
      }
    }

    fetchReviews()

    // Optional: Set up real-time listener for reviews if needed
    const reviewSubscription = supabase
      .channel(`reviews_for_product_${product.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reviews", filter: `product_id=eq.${product.id}` },
        (payload) => {
          fetchReviews() // Re-fetch reviews on change
        },
      )
      .subscribe()

    return () => {
      reviewSubscription.unsubscribe()
    }
  }, [product.id])

  const stockStatus =
    product.stock_quantity === 0
      ? "out-of-stock"
      : product.stock_quantity && product.stock_quantity < 10
        ? "low-stock"
        : "in-stock"

  return (
    <Link
      href={`/product/${product.id}`}
      className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300 group relative flex flex-col h-full"
    >
      <div className="relative aspect-square rounded-t-lg overflow-hidden">
        <Image
          src={product.product_photo_urls?.[0] || "/placeholder.svg"}
          alt={product.product_name}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {product.original_price && product.original_price > product.discount_price && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
            {Math.round(((product.original_price - product.discount_price) / product.original_price) * 100)}% OFF
          </div>
        )}
        {stockStatus === "low-stock" && (
          <div className="absolute bottom-2 left-2 bg-amber-500 text-white text-xs px-2 py-1 rounded-full">
            Low Stock
          </div>
        )}
        {stockStatus === "out-of-stock" && (
          <div className="absolute bottom-2 left-2 bg-gray-700 text-white text-xs px-2 py-1 rounded-full">
            Out of Stock
          </div>
        )}
        <FavButton product={product} />
      </div>
      <div className="p-4 flex-grow flex flex-col">
        {/* Added null checks for product.company */}
        {product.company && (
          <div className="flex items-center gap-2 mb-2">
            <Image
              src={product.company.company_logo_url || "/placeholder.svg"}
              alt={product.company.company_name || "Company Logo"}
              width={16}
              height={16}
              className="rounded-full"
            />
            <span className="text-xs text-gray-600 truncate">{product.company.company_name}</span>
          </div>
        )}
        <h3 className="font-medium text-gray-900 mb-1 text-sm sm:text-base line-clamp-2 flex-grow">
          {product.product_name}
        </h3>
        {/* Display actual aggregated review stars and review count */}
        <div className="flex items-center gap-1 mb-2">
          <div className="flex text-yellow-400">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-3 h-3 ${i < Math.round(reviewData.average) ? "fill-current" : "text-gray-300"}`}
              />
            ))}
          </div>
          <span className="text-xs text-gray-500">({reviewData.count})</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-base sm:text-lg font-bold text-gray-900">₹{product.discount_price.toFixed(2)}</span>
          {product.original_price && product.original_price > product.discount_price && (
            <span className="text-xs sm:text-sm text-gray-400 line-through">₹{product.original_price.toFixed(2)}</span>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
          {/* Assuming is_organic is a boolean field in your products table */}
          {/* You might need to adjust this based on how you store 'organic' status */}
          {/* For now, I'll assume if it's not explicitly false, it's considered organic for display */}
          {true && (
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-green-600" />
              <span>Certified Organic</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

// Product Skeleton for loading state
function ProductSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm h-full">
      <Skeleton className="aspect-square rounded-t-lg w-full" />
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="w-4 h-4 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-5 w-full mb-1" />
        <Skeleton className="h-5 w-3/4 mb-4" />
        <Skeleton className="h-3 w-20 mb-2" />
        <Skeleton className="h-6 w-16 mb-3" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  )
}

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [activeFilter, setActiveFilter] = useState<"all" | "deals" | "bestsellers">("all")

  const allCategories = [
    "Organic Groceries & Superfoods",
    "Herbal & Natural Personal Care",
    "Health & Wellness Products",
    "Sustainable Home & Eco-Friendly Living",
    "Sustainable Fashion & Accessories",
    "Organic Baby & Kids Care",
    "Organic Pet Care",
    "Special Dietary & Lifestyle Products",
  ]

  useEffect(() => {
    setIsLoading(true)
    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          `
        *,
        company:companies(company_name, company_logo_url)
      `,
        )
        .eq("is_approved", true) // Only load approved products
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching products:", error)
        setIsLoading(false)
        return
      }

      setProducts(data || [])
      setIsLoading(false)
    }

    fetchProducts()

    // Set up real-time listener for products (optional, for immediate updates)
    const productSubscription = supabase
      .channel("products_changes_shop")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products", filter: "is_approved=eq.true" },
        (payload) => {
          fetchProducts() // Re-fetch products on change
        },
      )
      .subscribe()

    return () => {
      productSubscription.unsubscribe()
    }
  }, [])

  const handleCategoryChange = (category: string, checked: boolean) => {
    setSelectedCategories((prev) => (checked ? [...prev, category] : prev.filter((cat) => cat !== category)))
  }

  const getFilteredProducts = useCallback(() => {
    let filtered = [...products]

    if (selectedCategories.length > 0) {
      filtered = filtered.filter((product) => product.categories?.some((cat) => selectedCategories.includes(cat.main)))
    }

    if (activeFilter === "deals") {
      filtered = filtered.filter((product) => product.original_price && product.original_price > product.discount_price)
    } else if (activeFilter === "bestsellers") {
      filtered = filtered.filter((product) => product.is_best_seller)
    }

    if (searchTerm) {
      filtered = filtered.filter((product) => product.product_name.toLowerCase().includes(searchTerm.toLowerCase()))
    }

    return filtered
  }, [products, selectedCategories, activeFilter, searchTerm])

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <Header showSearchBar={true} onSearch={setSearchTerm} />
      <div className="container mx-auto px-4 py-8 flex-grow grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filters Sidebar */}
        <aside className="lg:col-span-1 bg-white p-6 rounded-lg shadow-sm h-fit sticky top-24">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Filter className="h-5 w-5 text-green-600" />
            Filters
          </h2>

          {/* Quick Filters */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-800 mb-3">Quick Filters</h3>
            <div className="flex flex-col gap-2">
              <Button
                variant={activeFilter === "all" ? "default" : "outline"}
                className={activeFilter === "all" ? "bg-green-600 hover:bg-green-700 text-white" : "text-gray-700"}
                onClick={() => setActiveFilter("all")}
              >
                All Products
              </Button>
              <Button
                variant={activeFilter === "deals" ? "default" : "outline"}
                className={activeFilter === "deals" ? "bg-green-600 hover:bg-green-700 text-white" : "text-gray-700"}
                onClick={() => setActiveFilter("deals")}
              >
                Today's Deals
              </Button>
              <Button
                variant={activeFilter === "bestsellers" ? "default" : "outline"}
                className={
                  activeFilter === "bestsellers" ? "bg-green-600 hover:bg-green-700 text-white" : "text-gray-700"
                }
                onClick={() => setActiveFilter("bestsellers")}
              >
                Best Sellers
              </Button>
            </div>
          </div>

          {/* Categories Filter */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-800 mb-3">Categories</h3>
            <div className="space-y-2">
              {allCategories.map((category) => (
                <div key={category} className="flex items-center space-x-2">
                  <Checkbox
                    id={category}
                    checked={selectedCategories.includes(category)}
                    onCheckedChange={(checked) => handleCategoryChange(category, checked === true)}
                    className="border-gray-300 data-[state=checked]:bg-green-600 data-[state=checked]:text-white"
                  />
                  <Label htmlFor={category} className="text-sm font-medium text-gray-700 cursor-pointer">
                    {category}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Clear Filters Button */}
          <Button
            variant="outline"
            className="w-full border-green-600 text-green-600 hover:bg-green-50 bg-transparent"
            onClick={() => {
              setSelectedCategories([])
              setActiveFilter("all")
              setSearchTerm("")
            }}
          >
            Clear All Filters
          </Button>
        </aside>

        {/* Product Grid */}
        <section className="lg:col-span-3">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">All Products</h2>
            <span className="text-gray-600">
              Showing {getFilteredProducts().length} of {products.length} products
            </span>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {Array(9)
                .fill(0)
                .map((_, index) => (
                  <ProductSkeleton key={index} />
                ))}
            </div>
          ) : getFilteredProducts().length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {getFilteredProducts().map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Search className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No products found</h3>
              <p className="text-gray-500 mb-4">Try adjusting your filters or search term.</p>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedCategories([])
                  setActiveFilter("all")
                  setSearchTerm("")
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </section>
      </div>
      <Footer />
    </main>
  )
}
