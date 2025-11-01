"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { supabase } from "../../lib/supabase"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Loader2, HeartCrack, Trash2, ShoppingCart, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface FavoriteItem {
  id: string
  productId: string
  productName: string
  price: number
  originalPrice?: number
  thumbnail: string
  isInCart: boolean
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>("")
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const fetchFavorites = async () => {
      setLoading(true)
      setError(null)

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session) {
        toast({
          title: "Please log in to view your favorites.",
          variant: "destructive",
        })
        router.push("/login")
        return
      }

      const userId = session.user.id

      const { data: cartData } = await supabase
        .from("cart_items")
        .select("product_id")
        .eq("user_id", userId)

      const cartProductIds = new Set(cartData?.map((item) => item.product_id) || [])

      const { data, error: favError } = await supabase
        .from("favorites")
        .select(
          `
          id,
          product_id,
          products (
            product_name,
            discount_price,
            original_price,
            product_photo_urls
          )
        `
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (favError) {
        setError("Failed to load favorites. Please try again.")
        setFavorites([])
      } else {
        const fetchedFavorites: FavoriteItem[] =
          data?.map((fav) => {
            const prod = Array.isArray(fav.products) ? fav.products[0] : fav.products
            const productId = fav.product_id || ""

            return {
              id: fav.id,
              productId: productId,
              productName: prod?.product_name || "Unknown Product",
              price: prod?.discount_price ?? prod?.original_price ?? 0,
              originalPrice: prod?.original_price,
              thumbnail: prod?.product_photo_urls?.[0] || "/placeholder.svg",
              isInCart: cartProductIds.has(productId),
            }
          }) || []
        setFavorites(fetchedFavorites)
      }
      setLoading(false)
    }

    fetchFavorites()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push("/login")
      } else {
        fetchFavorites()
      }
    })

    const cartChangesListener = supabase
      .channel("favorites_page_cart_updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cart_items" },
        () => {
          fetchFavorites()
        }
      )
      .subscribe()

    return () => {
      authListener.subscription.unsubscribe()
      supabase.removeChannel(cartChangesListener)
    }
  }, [router, toast])

  const handleRemove = async (favId: string, productName: string) => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const userId = session?.user?.id

    if (!userId) {
      toast({
        title: "Please log in to remove favorites.",
        variant: "destructive",
      })
      return
    }

    try {
      const { error } = await supabase.from("favorites").delete().eq("id", favId).eq("user_id", userId)
      if (error) throw error

      setFavorites((prev) => prev.filter((item) => item.id !== favId))
      toast({
        title: `${productName} has been removed from your wishlist.`,
        variant: "default",
      })
    } catch (error: any) {
      toast({
        title: error.message || "Failed to remove product from favorites.",
        variant: "destructive",
      })
    }
  }

  const handleAddToCart = async (productId: string, productName: string, price: number) => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const userId = session?.user?.id

    if (!userId) {
      toast({
        title: "Please log in to add products to your cart.",
        variant: "destructive",
      })
      return
    }

    try {
      const { data: existingCartItem, error: fetchError } = await supabase
        .from("cart_items")
        .select("id")
        .eq("user_id", userId)
        .eq("product_id", productId)
        .single()

      if (fetchError && fetchError.code !== "PGRST116") {
        throw fetchError
      }

      if (existingCartItem) {
        toast({
          title: `${productName} is already in your cart!`,
          variant: "default",
        })
        setFavorites((prev) =>
          prev.map((item) => (item.productId === productId ? { ...item, isInCart: true } : item))
        )
        return
      }

      const { error } = await supabase.from("cart_items").insert({
        user_id: userId,
        product_id: productId,
        quantity: 1,
        price_at_add: price,
      })

      if (error) throw error

      toast({
        title: `${productName} has been added to your cart.`,
        variant: "default",
      })
      setFavorites((prev) =>
        prev.map((item) => (item.productId === productId ? { ...item, isInCart: true } : item))
      )
    } catch (error: any) {
      toast({
        title: error.message || "Failed to add product to cart.",
        variant: "destructive",
      })
    }
  }

  const handleGoToCart = () => {
    router.push("/cart")
  }

  const filteredFavorites = favorites.filter((item) =>
    item.productName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header showSearchBar={true} onSearch={setSearchTerm} />
        <main className="flex-grow container mx-auto px-4 py-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-3 text-lg text-blue-700">Loading favorites...</span>
        </main>
        <Footer />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header showSearchBar={true} onSearch={setSearchTerm} />
        <main className="flex-grow container mx-auto px-4 py-8">
          <div
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
            role="alert"
          >
            <strong className="font-bold">Error!</strong>
            <span className="block sm:inline"> {error}</span>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header showSearchBar={true} onSearch={setSearchTerm} />
      <main className="flex-grow container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6 text-gray-900">My Favorites</h1>

        {filteredFavorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <HeartCrack className="w-20 h-20 mb-4 text-gray-300" />
            <p className="text-xl font-medium mb-2">Your wishlist is empty!</p>
            <Button asChild>
              <Link href="/shop">Start Shopping</Link>
            </Button>
          </div>
        ) : (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
          >
            {filteredFavorites.map((item) => (
              <Card
                key={item.id}
                className="flex flex-col h-full group hover:shadow-lg transition-shadow"
              >
                <Link
                  href={`/product/${item.productId}`}
                  className="relative w-full aspect-[3/3] overflow-hidden rounded-t-lg"
                >
                  <Image
                    src={item.thumbnail || "/placeholder.svg"}
                    alt={item.productName}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                    className="object-cover group-hover:scale-105  transition-transform duration-300"
                  />
                </Link>

                <CardContent className="p-4 flex flex-col flex-grow">
                  <CardTitle className="text-lg font-semibold mb-2 line-clamp-2">
                    <Link
                      href={`/product/${item.productId}`}
                      className="hover:text-green-600 transition-colors"
                    >
                      {item.productName}
                    </Link>
                  </CardTitle>

                  <div className="flex items-baseline gap-2 mb-4">
                    <p className="text-xl font-bold text-gray-900">
                      ₹{item.price.toFixed(2)}
                    </p>
                    {item.originalPrice && item.originalPrice > item.price && (
                      <p className="text-sm text-gray-500 line-through">
                        ₹{item.originalPrice.toFixed(2)}
                      </p>
                    )}
                  </div>

                  <div className="mt-auto flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-transparent text-gray-700 hover:bg-gray-100"
                      onClick={() => handleRemove(item.id, item.productName)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Remove
                    </Button>

                    {item.isInCart ? (
                      <Button
                        size="sm"
                        className="flex-1 bg-green-500/20 text-green-700 hover:bg-green-500/30"
                        onClick={handleGoToCart}
                      >
                        <Check className="w-4 h-4 mr-2" /> In Cart
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() =>
                          handleAddToCart(
                            item.productId,
                            item.productName,
                            item.price
                          )
                        }
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" /> Add to Cart
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
