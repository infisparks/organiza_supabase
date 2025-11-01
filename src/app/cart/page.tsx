"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { supabase } from "../../lib/supabase"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Minus, Plus, Trash2, PackageX } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Separator } from "@/components/ui/separator"
import CheckoutDetailsModal from "@/components/checkout-details-modal"

// ✅ UPDATED CartItem interface to make product fields optional since 'products' can be null
interface CartItem {
  id: string
  product_id: string
  quantity: number
  price_at_add: number
  products: {
    product_name?: string // Made optional
    discount_price?: number // Made optional
    original_price?: number // Made optional
    product_photo_urls?: string[] // Made optional
  } | null
}

export default function CartPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState<string>("")
  const router = useRouter()
  const { toast } = useToast()

  const fetchCartItems = useCallback(async () => {
    setLoading(true)
    setError(null)

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      toast({
        title: "Please log in to view your cart.",
        variant: "destructive",
      })
      router.push("/login")
      return
    }

    const userId = session.user.id

    const { data, error: cartError } = await supabase
      .from("cart_items")
      .select(
        `
      id,
      product_id,
      quantity,
      price_at_add,
      products (
        product_name,
        discount_price,
        original_price,
        product_photo_urls
      )
    `,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (cartError) {
      setError("Failed to load cart items. Please try again.")
      setCartItems([])
    } else {
      // Defensive: handle array/object/null for products
      const fixedData: CartItem[] =
        data?.map((item: any) => {
          let prod = item.products
          if (Array.isArray(prod)) prod = prod[0] ?? null
          return {
            id: item.id,
            product_id: item.product_id,
            quantity: item.quantity,
            price_at_add: item.price_at_add,
            products: prod, // prod can be null if product was deleted
          }
        }) ?? []
      setCartItems(fixedData)
    }
    setLoading(false)
  }, [router, toast])

  useEffect(() => {
    fetchCartItems()

    // Listen for auth state changes to re-fetch cart items
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push("/login")
      } else {
        fetchCartItems()
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [fetchCartItems, router])

  // Added real-time listener for cart item updates (quantity changes)
  useEffect(() => {
    const channel = supabase
      .channel("cart_items_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cart_items",
        },
        () => {
          // Re-fetch cart items whenever any change occurs in the table
          fetchCartItems()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchCartItems])


  const handleQuantityChange = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return

    const {
      data: { session },
    } = await supabase.auth.getSession()
    const userId = session?.user?.id

    if (!userId) {
      toast({
        title: "Please log in to update cart quantity.",
        variant: "destructive",
      })
      return
    }

    try {
      const { error } = await supabase
        .from("cart_items")
        .update({ quantity: newQuantity })
        .eq("id", itemId)
        .eq("user_id", userId)

      if (error) throw error

      // Optimistic UI update for immediate response
      setCartItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, quantity: newQuantity } : item)))
    } catch (error: any) {
      toast({
        title: error.message || "Failed to update product quantity.",
        variant: "destructive",
      })
    }
  }

  const handleRemoveItem = async (itemId: string, productName: string) => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const userId = session?.user?.id

    if (!userId) {
      toast({
        title: "Please log in to remove items from cart.",
        variant: "destructive",
      })
      return
    }

    try {
      const { error } = await supabase.from("cart_items").delete().eq("id", itemId).eq("user_id", userId)

      if (error) throw error

      setCartItems((prev) => prev.filter((item) => item.id !== itemId))
      toast({
        title: `${productName} has been removed from your cart.`,
        variant: "default",
      })
    } catch (error: any) {
      toast({
        title: error.message || "Failed to remove product from cart.",
        variant: "destructive",
      })
    }
  }

  // Filter cart items based on search term
  const filteredCartItems = cartItems.filter((item) =>
    item.products?.product_name?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  // 🎯 CORE CALCULATION: Subtotal includes quantity for each item
  const subtotal = filteredCartItems.reduce((sum, item) => {
    const price = item.products?.discount_price ?? item.products?.original_price ?? item.price_at_add
    return sum + price * item.quantity
  }, 0)
  
  const shippingFee = subtotal > 0 && subtotal < 1000 ? 99 : 0
  const total = subtotal + shippingFee

  const handleProceedToCheckout = () => {
    if (filteredCartItems.length === 0) {
      toast({
        title: "Please add items to your cart before proceeding to checkout.",
        variant: "destructive",
      })
      return
    }
    setShowCheckoutModal(true)
  }

  const handleOrderSuccess = async () => {
    // Clear the cart after successful order
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (userId) {
      const { error } = await supabase.from("cart_items").delete().eq("user_id", userId)
      if (!error) setCartItems([])
    }
    router.push("/orders")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header showSearchBar={true} onSearch={setSearchTerm} />
        <main className="flex-grow container mx-auto px-4 py-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-3 text-lg text-blue-700">Loading cart...</span>
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
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
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
        <h1 className="text-3xl font-bold mb-6 text-gray-900">Your Shopping Cart</h1>

        {filteredCartItems.length === 0 && cartItems.length > 0 && searchTerm !== "" ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <p className="text-xl font-medium mb-2">No results found for "{searchTerm}"</p>
            <p className="text-md mb-6">Try a different search term or clear the search bar.</p>
            <Button onClick={() => setSearchTerm("")}>Clear Search</Button>
          </div>
        ) : filteredCartItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <PackageX className="w-20 h-20 mb-4 text-gray-300" />
            <p className="text-xl font-medium mb-2">Your cart is empty!</p>
            <p className="text-md mb-6">Looks like you haven't added anything to your cart yet.</p>
            <Button asChild>
              <Link href="/shop">Start Shopping</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items List */}
            <div className="lg:col-span-2 space-y-4">
              {filteredCartItems.map((item) => (
                <Card key={item.id} className="flex flex-col sm:flex-row items-center sm:items-start p-4 shadow-sm">
                  {/* Image Link */}
                  <Link
                    href={`/product/${item.product_id}`}
                    className="relative w-24 h-24 flex-shrink-0 rounded-md overflow-hidden border mb-4 sm:mb-0"
                  >
                    {/* ✅ Used optional chaining with fallback */}
                    <Image
                      src={item.products?.product_photo_urls?.[0] || "/placeholder.svg"}
                      alt={item.products?.product_name || "Product Image"}
                      fill
                      sizes="(max-width: 1024px) 100vw, 96px"
                      className="object-cover"
                    />
                  </Link>
                  
                  {/* Product Details & Actions */}
                  <div className="ml-0 sm:ml-4 flex-grow flex flex-col sm:flex-row justify-between w-full sm:w-auto">
                    
                    {/* Name & Price Column (Aligned Left) */}
                    <div className="flex flex-col justify-center mb-3 sm:mb-0 sm:w-3/5">
                      <h2 className="text-lg font-semibold text-gray-900 line-clamp-2 text-center sm:text-left">
                        <Link href={`/product/${item.product_id}`} className="hover:text-green-600 transition-colors">
                          {item.products?.product_name || "Unknown Product"}
                        </Link>
                      </h2>
                      <p className="text-gray-600 mt-1 text-center sm:text-left">
                        {/* Display the unit price */}
                        Unit Price: ₹
                        {(item.products?.discount_price ?? item.products?.original_price ?? item.price_at_add).toFixed(2)}
                      </p>
                      {/* 🎯 DISPLAY ITEM SUBTOTAL */}
                      <p className="text-gray-900 font-medium text-sm mt-1 text-center sm:text-left">
                        Total: ₹{((item.products?.discount_price ?? item.products?.original_price ?? item.price_at_add) * item.quantity).toFixed(2)}
                      </p>
                    </div>

                    {/* Quantity & Remove Column (Aligned Right/Centered) */}
                    <div className="flex items-center justify-center sm:justify-end sm:w-2/5 space-x-4">
                      {/* Quantity Selector */}
                      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 bg-transparent"
                          onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="mx-3 text-md font-medium">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 bg-transparent"
                          onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {/* Remove Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => handleRemoveItem(item.id, item.products?.product_name || "Item")}
                      >
                        <Trash2 className="h-5 w-5" />
                        <span className="sr-only">Remove item</span>
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between text-gray-700">
                    {/* 🎯 Display number of items correctly */}
                    <span>Subtotal ({filteredCartItems.reduce((acc, item) => acc + item.quantity, 0)} items)</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>Shipping</span>
                    <span>{shippingFee === 0 ? "Free" : `₹${shippingFee.toFixed(2)}`}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-lg text-gray-900">
                    <span>Total</span>
                    <span>₹{total.toFixed(2)}</span>
                  </div>
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
                    onClick={handleProceedToCheckout}
                  >
                    Proceed to Checkout
                  </Button>
                  <p className="text-center text-sm text-gray-500 mt-4">Shipping calculated at checkout.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
      <Footer />
      {showCheckoutModal && (
        <CheckoutDetailsModal
          isOpen={showCheckoutModal}
          onClose={() => setShowCheckoutModal(false)}
          // 🎯 Pass the correctly mapped and calculated item details to the modal
          items={filteredCartItems.map((item) => {
            const unitPrice = item.products?.discount_price ?? item.products?.original_price ?? item.price_at_add;
            return {
              productId: item.product_id,
              productName: item.products?.product_name || "Unknown Product",
              quantity: item.quantity,
              // Use the actual unit price, the modal calculates the total from this
              price_at_add: unitPrice, 
            }
          })}
          onOrderSuccess={handleOrderSuccess}
        />
      )}
    </div>
  )
}