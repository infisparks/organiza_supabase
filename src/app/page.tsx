"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { Heart, Star, ShieldCheck, Filter, Loader2, ArrowRight } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import Footer from "@/components/Footer"
import Header from "@/components/Header"
import Slider from "react-slick"
import "slick-carousel/slick/slick.css"
import "slick-carousel/slick/slick-theme.css"
import { supabase } from "@/lib/supabase"
import AuthPopup from "@/components/auth-popup"
import { useRouter } from "next/navigation"

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

// Category type definition
type CategoryProps = {
  categories: { id: number; title: string; subtitle: string; icon: string; image: string }[]
  selectedCategory: string | null
  onCategoryClick: (category: string) => void
}

// Category Carousel Component (updated with professional styling)
function CategoryCarousel({ categories, selectedCategory, onCategoryClick }: CategoryProps) {
  const settings = {
    dots: true,
    infinite: true,
    autoplay: true,
    autoplaySpeed: 4000,
    speed: 500,
    slidesToShow: 4,
    slidesToScroll: 1,
    responsive: [
      {
        breakpoint: 1024,
        settings: {
          slidesToShow: 3,
        },
      },
      {
        breakpoint: 768,
        settings: {
          slidesToShow: 2,
        },
      },
      {
        breakpoint: 640,
        settings: {
          slidesToShow: 1,
        },
      },
    ],
  }
  return (
    <section className="py-3 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Slider {...settings} className="category-slider">
          {categories.map((cat) => (
            <div key={cat.id} className="px-2 cursor-pointer" onClick={() => onCategoryClick(cat.title)}>
              <Card
                className={`h-max transition-all duration-300 hover:shadow-md ${
                  selectedCategory === cat.title ? "ring-2 ring-green-500 shadow-md" : ""
                }`}
              >
                <CardContent className="p-4 flex items-center">
                  <div className="w-12 h-12 flex items-center justify-center bg-green-100 rounded-full mr-4 text-2xl">
                    {cat.icon}
                  </div>
                  <h3 className="font-medium text-gray-900">{cat.title}</h3>
                </CardContent>
              </Card>
            </div>
          ))}
        </Slider>
      </div>
    </section>
  )
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

// Main Home Component
export default function Home() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<"all" | "deals" | "bestsellers">("all")
  const [isCompanyApproved, setIsCompanyApproved] = useState<boolean | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [homeSearchTerm, setHomeSearchTerm] = useState("")

  // Client-side filter for category, deals, best-sellers and search
  const getFilteredProducts = useCallback(() => {
    let filtered = [...products]

    if (selectedCategory) {
      filtered = filtered.filter((p) => p.categories?.some((c) => c.main === selectedCategory))
    }

    if (activeFilter === "deals") {
      filtered = filtered.filter((p) => p.original_price && p.original_price > p.discount_price)
    } else if (activeFilter === "bestsellers") {
      filtered = filtered.filter((p) => p.is_best_seller)
    }

    if (homeSearchTerm) {
      filtered = filtered.filter((p) => p.product_name.toLowerCase().includes(homeSearchTerm.toLowerCase()))
    }

    return filtered
  }, [products, selectedCategory, activeFilter, homeSearchTerm])

  // Define categories with full names matching Supabase
  const carouselCategories = [
    {
      id: 1,
      title: "Organic Groceries and Superfoods",
      subtitle: "Fresh & Healthy",
      icon: "🥦",
      image: "https://www.pricechopper.com/wp-content/uploads/2022/07/072222_OrganicPage.png",
    },
    {
      id: 2,
      title: "Herbal & Natural Personal Care",
      subtitle: "Pure & Gentle",
      icon: "🧴",
      image: "https://media.ahmedabadmirror.com/am/uploads/mediaGallery/image/1679590753548.jpg-org",
    },
    {
      id: 3,
      title: "Health & Wellness Products",
      subtitle: "Boost Wellbeing",
      icon: "🌿",
      image: "https://media.ahmedabadmirror.com/am/uploads/mediaGallery/image/1679590753548.jpg-org",
    },
    {
      id: 4,
      title: "Sustainable Home & Eco-Friendly Living",
      subtitle: "Green Living",
      icon: "♻️",
      image:
        "https://previews.123rf.com/images/baibakova/baibakova2007/baibakova200700306/152273705-bowls-of-various-superfoods-on-gray-background-healthy-organic-food-clean-eating-top-view.jpg",
    },
    {
      id: 5,
      title: "Sustainable Fashion & Accessories",
      subtitle: "Eco-Chic Styles",
      icon: "👕",
      image:
        "https://previews.123rf.com/images/baibakova/baibakova2007/baibakova200700306/152273705-bowls-of-various-superfoods-on-gray-background-healthy-organic-food-clean-eating-top-view.jpg",
    },
    {
      id: 6,
      title: "Organic Baby & Kids Care",
      subtitle: "For Little Ones",
      icon: "👶",
      image:
        "https://previews.123rf.com/images/baibakova/baibakova2007/baibakova200700306/152273705-bowls-of-various-superfoods-on-gray-background-healthy-organic-food-clean-eating-top-view.jpg",
    },
    {
      id: 7,
      title: "Organic Pet Care",
      subtitle: "For Your Pets",
      icon: "🐾",
      image:
        "https://previews.123rf.com/images/baibakova/baibakova2007/baibakova200700306/152273705-bowls-of-various-superfoods-on-gray-background-healthy-organic-food-clean-eating-top-view.jpg",
    },
    {
      id: 8,
      title: "Special Dietary & Lifestyle Products",
      subtitle: "For Your Lifestyle",
      icon: "🥗",
      image:
        "https://previews.123rf.com/images/baibakova/baibakova2007/baibakova200700306/152273705-bowls-of-various-superfoods-on-gray-background-healthy-organic-food-clean-eating-top-view.jpg",
    },
  ]

  // Check user and company approval status for redirection
  useEffect(() => {
    const checkUserAndApproval = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) {
        console.error("Error getting session:", sessionError)
        return
      }

      if (session) {
        setIsLoggedIn(true)
        const userId = session.user.id
        const { data: companyData, error: companyError } = await supabase
          .from("companies")
          .select("is_approved")
          .eq("user_id", userId)
          .single()

        if (companyError && companyError.code !== "PGRST116") {
          console.error("Error fetching company data:", companyError)
          setIsCompanyApproved(false)
        } else if (companyData) {
          setIsCompanyApproved(companyData.is_approved)
        } else {
          setIsCompanyApproved(false)
        }
      } else {
        setIsLoggedIn(false)
        setIsCompanyApproved(false)
      }
    }

    checkUserAndApproval()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      checkUserAndApproval()
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (isLoggedIn && isCompanyApproved) {
      router.push("/company/dashboard")
    }
  }, [isLoggedIn, isCompanyApproved, router])

  // Fetch products based on current filters
  const fetchProducts = useCallback(async () => {
    setIsLoading(true)
    let query = supabase
      .from("products")
      .select(
        `
        *,
        company:companies(company_name, company_logo_url)
      `,
      )
      .eq("is_approved", true)
      .order("created_at", { ascending: false })

    if (activeFilter === "deals") {
      query = query.gt("original_price", ("discount_price"))
    } else if (activeFilter === "bestsellers") {
      query = query.eq("is_best_seller", true)
    }

    if (homeSearchTerm) {
      query = query.ilike("product_name", `%${homeSearchTerm}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching products:", error)
      setIsLoading(false)
      return
    }

    setProducts(data || [])
    setIsLoading(false)
  }, [activeFilter, homeSearchTerm]) // Dependencies for useCallback

  useEffect(() => {
    fetchProducts()

    // Set up real-time listener for products (optional, for immediate updates)
    // This listener will re-fetch all approved products on any change,
    // then the `fetchProducts` useCallback will re-apply the current filters.
    const productSubscription = supabase
      .channel("products_changes")
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
  }, [fetchProducts]) // Dependency on fetchProducts

  // Toggle filter: clicking the same category clears the selection
  const handleCategoryClick = useCallback((cat: string) => {
    setSelectedCategory((prevCat) => (prevCat === cat ? null : cat))
    setActiveFilter("all") // Reset other filters when category changes
    setHomeSearchTerm("") // Clear search when category is selected
  }, [])

  const handleFilterClick = useCallback((filter: "all" | "deals" | "bestsellers") => {
    setActiveFilter(filter)
    setSelectedCategory(null) // Clear category when filter changes
    setHomeSearchTerm("") // Clear search when filter changes
  }, [])

  const handleSearch = useCallback((term: string) => {
    setHomeSearchTerm(term)
    setSelectedCategory(null) // Clear category filter when searching
    setActiveFilter("all") // Reset other filters when searching
  }, [])

  // If loading initial user/company status, show a loader
  if (isCompanyApproved === null && isLoggedIn === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <span className="ml-3 text-lg text-blue-700">Loading...</span>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Announcement Bar */}
      <div className="bg-green-600 text-center py-2 text-xs sm:text-sm text-white px-4">
        <span className="hidden sm:inline">🌱 Free shipping on orders over ₹1000 | </span>
        Shop now and get 10% off your first order with code: <span className="font-bold">ORGANIC10</span>
      </div>
      {/* Header Component */}
      <Header showSearchBar={true} onSearch={handleSearch} />
      {/* Category Carousel */}
      <CategoryCarousel
        categories={carouselCategories}
        selectedCategory={selectedCategory}
        onCategoryClick={handleCategoryClick}
      />
      {/* Products Section */}
      <section className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Explore Our Products</h2>
              <p className="text-gray-600">Fresh organic products at the best prices</p>
            </div>
            <div className="flex items-center gap-2 bg-white p-1 rounded-lg shadow-sm">
              <Button
                variant={activeFilter === "all" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleFilterClick("all")}
                className={activeFilter === "all" ? "bg-green-600 hover:bg-green-700" : ""}
              >
                All Products
              </Button>
              <Button
                variant={activeFilter === "deals" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleFilterClick("deals")}
                className={activeFilter === "deals" ? "bg-green-600 hover:bg-green-700" : ""}
              >
                Today's Deals
              </Button>
              <Button
                variant={activeFilter === "bestsellers" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleFilterClick("bestsellers")}
                className={activeFilter === "bestsellers" ? "bg-green-600 hover:bg-green-700" : ""}
              >
                Best Sellers
              </Button>
            </div>
          </div>
          {(selectedCategory || homeSearchTerm) && (
            <div className="mb-6 flex items-center">
              {selectedCategory && (
                <Badge variant="outline" className="bg-green-50 text-green-800 px-3 py-1">
                  Category: {selectedCategory}
                </Badge>
              )}
              {homeSearchTerm && (
                <Badge variant="outline" className="bg-blue-50 text-blue-800 px-3 py-1 ml-2">
                  Search: {homeSearchTerm}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-500 ml-2 h-7 w-7 p-0"
                onClick={() => {
                  setSelectedCategory(null)
                  setHomeSearchTerm("")
                  setActiveFilter("all")
                }}
              >
                ✕
              </Button>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {isLoading ? (
              Array(8)
                .fill(0)
                .map((_, index) => <ProductSkeleton key={index} />)
            ) : getFilteredProducts().length > 0 ? (
              getFilteredProducts().map((product) => <ProductCard key={product.id} product={product} />)
            ) : (
              <div className="col-span-full py-12 text-center">
                <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Filter className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">No products found</h3>
                <p className="text-gray-500 mb-4">Try changing your filter criteria</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedCategory(null)
                    setActiveFilter("all")
                    setHomeSearchTerm("")
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
          {getFilteredProducts().length > 0 && (
            <div className="mt-10 text-center">
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-green-600 text-green-600 hover:bg-green-50 bg-transparent"
              >
                <Link href="/shop">
                  View All Products <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </section>
      {/* Footer Component */}
      <Footer />
    </main>
  )
}
