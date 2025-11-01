"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Edit, Eye, PackageX, AlertCircle, Camera, Package } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Product {
  id: string
  product_name: string
  product_description: string
  original_price: number
  discount_price: number
  stock_quantity: number
  product_photo_urls: string[]
  is_approved: boolean
  created_at: string
}

export default function MyProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true)
      setError(null)

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session) {
        setError("User not authenticated.")
        setLoading(false)
        return
      }

      const userId = session.user.id

      // First, get the company_id for the logged-in user
      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", userId)
        .single()

      if (companyError || !companyData) {
        setError("Company record not found for this user.")
        setLoading(false)
        return
      }

      const companyId = companyData.id

      // Then, fetch products for that company_id
      const { data, error: productsError } = await supabase
        .from("products")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })

      if (productsError) {
        console.error("Error fetching products:", productsError)
        setError("Failed to load products. Please try again.")
      } else {
        setProducts(data || [])
      }
      setLoading(false)
    }

    fetchProducts()
  }, [toast])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        <span className="ml-3 text-lg text-green-700">Loading products...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-10 bg-gradient-to-br from-green-50 via-white to-blue-100 min-h-screen pb-10">
      {/* Professional Top Navbar */}
      <nav className="w-full h-16 px-6 flex items-center bg-gradient-to-r from-white via-blue-50 to-blue-100 shadow-sm rounded-b-2xl mb-8 font-[Inter,sans-serif]">
        <div className="flex items-center gap-3">
          <Package className="h-7 w-7 text-blue-500" />
          <span className="text-xl md:text-2xl font-semibold tracking-tight text-gray-800">My Products</span>
        </div>
      </nav>
      <div className="flex items-center justify-center mb-8">
        <Button asChild className="bg-gradient-to-r from-green-500 via-blue-600 to-green-400 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:scale-105 transition-transform duration-200">
          <Link href="/company/dashboard/add-product">Add New Product</Link>
        </Button>
      </div>
      {products.length === 0 ? (
        <Card className="p-8 text-center shadow-lg border-0 bg-gradient-to-br from-pink-50 via-pink-100 to-pink-50 rounded-2xl">
          <PackageX className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <p className="text-lg text-gray-600">You haven't added any products yet.</p>
          <p className="text-sm text-gray-500 mt-2">Click "Add New Product" to get started!</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product, idx) => (
            <Card
              key={product.id}
              className={`flex flex-col shadow-xl border-0 rounded-2xl bg-gradient-to-br ${[
                "from-pink-100 via-pink-50 to-pink-200",
                "from-blue-100 via-blue-50 to-blue-200",
                "from-green-100 via-green-50 to-green-200",
                "from-yellow-100 via-yellow-50 to-yellow-200",
                "from-purple-100 via-purple-50 to-purple-200",
                "from-orange-100 via-orange-50 to-orange-200",
              ][idx % 6]} hover:scale-105 transition-transform duration-200`}
            >
              <CardHeader className="relative pb-0">
                <div className="aspect-square rounded-md overflow-hidden bg-gray-100 mb-4 border border-gray-200">
                  {product.product_photo_urls && product.product_photo_urls.length > 0 ? (
                    <img
                      src={product.product_photo_urls[0] || "/placeholder.svg"}
                      alt={product.product_name}
                      className="w-full h-full object-cover"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      <Camera className="h-12 w-12" />
                    </div>
                  )}
                </div>
                <Badge
                  className={`absolute top-4 right-4 px-3 py-1 text-xs font-medium ${
                    product.is_approved ? "bg-green-500 text-white" : "bg-yellow-500 text-white"
                  }`}
                >
                  {product.is_approved ? "Approved" : "Pending Approval"}
                </Badge>
                <CardTitle className="text-xl text-gray-900">{product.product_name}</CardTitle>
                <p className="text-sm text-gray-500 line-through">₹{product.original_price.toFixed(2)}</p>
                <p className="text-lg font-bold text-green-600">₹{product.discount_price.toFixed(2)}</p>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col justify-between pt-4">
                <p className="text-sm text-gray-700 mb-4 line-clamp-3">
                  {product.product_description || "No description available."}
                </p>
                <div className="flex justify-between items-center text-sm text-gray-600">
                  <span>Stock: {product.stock_quantity}</span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="bg-gradient-to-r from-blue-500 to-green-400 text-white font-semibold border-0 rounded-lg shadow-md hover:scale-105 hover:from-green-400 hover:to-blue-500 transition-transform duration-200"
                    >
                      <Link href={`/company/dashboard/edit-product/${product.id}`}>
                        <Edit className="h-4 w-4 mr-2" /> Edit
                      </Link>
                    </Button>
                    {/* <Button
                      variant="secondary"
                      size="sm"
                      asChild
                      className="bg-gradient-to-r from-pink-500 to-purple-400 text-white font-semibold border-0 rounded-lg shadow-md hover:scale-105 hover:from-purple-400 hover:to-pink-500 transition-transform duration-200"
                    >
                      <Link href={`/product/${product.id}`}>
                        <Eye className="h-4 w-4 mr-2" /> View
                      </Link>
                    </Button> */}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
