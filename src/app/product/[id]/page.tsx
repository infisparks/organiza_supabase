import ProductDetails from "./ProductDetails"
import { notFound } from "next/navigation"
import { supabase } from "../../../lib/supabase" // Supabase import
import Header from "@/components/Header" // Corrected import path for Header
import Footer from "@/components/Footer" // Import Footer

// Generate static params by fetching all approved product IDs from Supabase
export async function generateStaticParams() {
  const { data, error } = await supabase.from("products").select("id").eq("is_approved", true)

  if (error) {
    console.error("Error fetching product IDs for static params:", error)
    return []
  }

  return data.map((product) => ({ id: product.id.toString() }))
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  // Fetch product details from Supabase, including company information
  const { data: productFound, error } = await supabase
    .from("products")
    .select(
      `
      *,
      company:companies(company_name, company_logo_url)
    `,
    )
    .eq("id", params.id)
    .eq("is_approved", true) // Only fetch approved products
    .single()

  if (error || !productFound) {
    console.error("Error fetching product:", error)
    return notFound()
  }

  // Map Supabase data to the expected ProductDetailsProps format
  const productDetailsProps = {
    id: productFound.id,
    productName: productFound.product_name,
    productDescription: productFound.product_description,
    originalPrice: productFound.original_price,
    discountPrice: productFound.discount_price,
    productPhotoUrls: productFound.product_photo_urls,
    productVideoUrl: productFound.product_video_url, // Pass video URL if available
    company_id: productFound.company_id, // ✅ Add this line 
    company: {
      name: productFound.company?.company_name || "Unknown Company", // Handle null company
      logo: productFound.company?.company_logo_url || "/placeholder.svg", // Handle null company logo
    },
    nutrients: productFound.nutrients,
  }

  return (
    <>
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <ProductDetails product={productDetailsProps} />
        </div>
      </div>
      <Footer />
    </>
  )
}
