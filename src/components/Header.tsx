"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ShoppingCart, Heart, Search, Leaf, Menu, X } from "lucide-react"
import { supabase } from "@/lib/supabase" // Supabase import
import { Input } from "@/components/ui/input" // Import Input component

interface HeaderProps {
  showSearchBar?: boolean
  onSearch?: (term: string) => void
}

export default function Header({ showSearchBar = true, onSearch }: HeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [cartCount, setCartCount] = useState(0)
  const [favCount, setFavCount] = useState(0)
  const [user, setUser] = useState<any>(null)
  const [localSearchTerm, setLocalSearchTerm] = useState("") // Local state for search input
  const router = useRouter()

  useEffect(() => {
    let cartChannel: any = null;
    let favChannel: any = null;

    const getSessionAndCounts = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const currentUserId = session?.user?.id || null
      setUser(session?.user || null)

      if (currentUserId) {
        // Fetch cart count
        const { count: cartItemsCount, error: cartError } = await supabase
          .from("cart_items")
          .select("id", { count: "exact" })
          .eq("user_id", currentUserId)
        if (cartError) console.error("Error fetching cart count:", cartError.message || cartError)
        setCartCount(cartItemsCount || 0)

        // Fetch favorites count
        const { count: favItemsCount, error: favError } = await supabase
          .from("favorites")
          .select("id", { count: "exact" })
          .eq("user_id", currentUserId)
        if (favError) console.error("Error fetching favorites count:", favError.message || favError)
        setFavCount(favItemsCount || 0)

        // --- Real-time subscriptions ---
        cartChannel = supabase
          .channel(`realtime_cart_items_${currentUserId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'cart_items',
              filter: `user_id=eq.${currentUserId}`,
            },
            (payload) => {
              // Re-fetch cart count on any change
              getSessionAndCounts()
            }
          )
          .subscribe()

        favChannel = supabase
          .channel(`realtime_favorites_${currentUserId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'favorites',
              filter: `user_id=eq.${currentUserId}`,
            },
            (payload) => {
              // Re-fetch fav count on any change
              getSessionAndCounts()
            }
          )
          .subscribe()
      } else {
        setCartCount(0)
        setFavCount(0)
      }
    }

    getSessionAndCounts()

    // Listen to auth state changes for real-time user updates
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
      getSessionAndCounts()
    })

    return () => {
      authListener.subscription.unsubscribe()
      if (cartChannel) supabase.removeChannel(cartChannel)
      if (favChannel) supabase.removeChannel(favChannel)
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearchTerm(e.target.value)
    if (onSearch) {
      onSearch(e.target.value)
    }
  }

  return (
    <nav className="bg-white border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
          onClick={() => setIsMobileMenuOpen(true)}
          aria-label="Open mobile menu"
        >
          <Menu className="w-6 h-6 text-gray-600" />
        </button>
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <Leaf className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 group-hover:rotate-12 transition-transform duration-300" />
          <span className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Organixa</span>
        </Link>
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
          <Link href="/" className="text-gray-700 hover:text-green-600 font-medium transition-colors">
            Home
          </Link>
          <Link href="/shop" className="text-gray-700 hover:text-green-600 font-medium transition-colors">
            Shop
          </Link>
          <Link href="/orders" className="text-gray-700 hover:text-green-600 font-medium transition-colors">
            Orders
          </Link>
          {user ? (
            <>
              <Link href="/profile" className="text-gray-700 hover:text-green-600 font-medium transition-colors">
                Profile
              </Link>
              <button
                onClick={handleLogout}
                className="text-gray-700 hover:text-green-600 font-medium transition-colors"
              >
                Logout
              </button>
            </>
          ) : (
            <Link href="/login" className="text-gray-700 hover:text-green-600 font-medium transition-colors">
              Login
            </Link>
          )}
        </div>
        {/* Right Section */}
        <div className="flex items-center gap-3 sm:gap-6">
          {/* Search Bar (Desktop & Mobile) */}
          {showSearchBar && (
            <>
              {/* Desktop Search Input */}
              <div className="hidden sm:block relative">
                <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Search products..."
                  value={localSearchTerm}
                  onChange={handleSearchInputChange}
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-full text-sm focus:outline-none w-[140px] sm:w-[180px] lg:w-[220px] focus:ring-green-500 focus:border-green-500 transition-all duration-300"
                />
              </div>
              {/* Mobile Search Button (as input) */}
              <div className="sm:hidden relative">
                <Search className="w-6 h-6 text-gray-600 absolute left-2 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Search..."
                  value={localSearchTerm}
                  onChange={handleSearchInputChange}
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-full text-sm focus:outline-none w-32 focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </>
          )}

          {/* Favorites Icon */}
          <Link href="/addfav" className="relative" aria-label="View favorites">
            <Heart className="w-6 h-6 text-gray-600 cursor-pointer hover:text-green-600 transition-colors hover:scale-110 transform duration-300" />
            {favCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-pink-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-bounce">
                {favCount}
              </span>
            )}
          </Link>
          {/* Shopping Cart Icon */}
          <Link href="/cart" className="relative" aria-label="View shopping cart">
            <ShoppingCart className="w-6 h-6 text-gray-600 cursor-pointer hover:text-green-600 transition-colors hover:scale-110 transform duration-300" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-green-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-bounce">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 md:hidden">
          <div className="fixed inset-y-0 left-0 w-[80%] max-w-sm bg-white shadow-xl">
            <div className="p-4 border-b flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Leaf className="h-6 w-6 text-green-600" />
                <span className="text-xl font-bold text-gray-900">Organixa</span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
                aria-label="Close mobile menu"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>
            <div className="py-4">
              <nav className="flex flex-col">
                <Link
                  href="/"
                  className="block px-4 py-3 text-gray-700 hover:bg-gray-50"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Home
                </Link>
                <Link
                  href="/shop"
                  className="block px-4 py-3 text-gray-700 hover:bg-gray-50"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Shop
                </Link>
                <Link
                  href="/orders"
                  className="block px-4 py-3 text-gray-700 hover:bg-gray-50"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Orders
                </Link>
                {user ? (
                  <>
                    <Link
                      href="/profile"
                      className="block px-4 py-3 text-gray-700 hover:bg-gray-50"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Profile
                    </Link>
                    <button
                      onClick={() => {
                        handleLogout()
                        setIsMobileMenuOpen(false)
                      }}
                      className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    className="block px-4 py-3 text-gray-700 hover:bg-gray-50"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Login
                  </Link>
                )}
              </nav>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
