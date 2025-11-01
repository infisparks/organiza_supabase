"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { AlertCircle, ArrowLeft, Loader2, Edit } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { AddEditProductForm, type ProductFormData } from "@/components/company/add-edit-product-form"

interface ProductDataFromDB {
  id: string
  product_name: string
  product_description: string
  original_price: number
  discount_price: number
  stock_quantity: number
  weight: number
  weight_unit: string
  length: number
  width: number
  height: number
  dimension_unit: string
  nutrients: Array<{ name: string; value: string }>
  categories: Array<{ main: string; sub: string }>
  product_photo_urls: string[]
  product_video_url: string | null
  is_approved: boolean
  company_id: string
}

export default function EditProductPage() {
  const router = useRouter()
  const { id } = useParams() // Get product ID from URL
  const { toast } = useToast()

  const [initialProductData, setInitialProductData] = useState<ProductFormData | undefined>(undefined)
  const [pageLoading, setPageLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [submissionError, setSubmissionError] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!id) {
      setFetchError("Product ID is missing.")
      setPageLoading(false)
      return
    }

    const fetchProductAndAuth = async () => {
      setPageLoading(true)
      setFetchError(null)

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session) {
        toast({
          title: "Authentication Required",
          description: "Please log in to edit products.",
          variant: "destructive",
        })
        router.push("/login")
        return
      }

      const userId = session.user.id

      // First, get the company_id for the logged-in user
      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .select("id, is_approved")
        .eq("user_id", userId)
        .single()

      if (companyError || !companyData) {
        console.error("Error fetching company data:", companyError)
        setFetchError("Company record not found or not approved for this user.")
        setPageLoading(false)
        return
      }

      if (!companyData.is_approved) {
        toast({
          title: "Approval Pending",
          description: "Your company must be approved to edit products.",
          variant: "destructive",
        })
        router.push("/company/dashboard")
        setPageLoading(false)
        return
      }

      const companyId = companyData.id

      // Fetch the specific product, ensuring it belongs to the current company
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .eq("company_id", companyId) // Crucial for security: only allow editing own products
        .single()

      if (productError || !productData) {
        console.error("Error fetching product:", productError)
        setFetchError("Product not found or you don't have permission to edit it.")
      } else {
        // Map fetched data to ProductFormData
        const mappedData: ProductFormData = {
          productName: productData.product_name,
          productDescription: productData.product_description,
          originalPrice: productData.original_price.toString(),
          discountPrice: productData.discount_price.toString(),
          stockQuantity: productData.stock_quantity.toString(),
          weight: productData.weight.toString(),
          weightUnit: productData.weight_unit,
          length: productData.length.toString(),
          width: productData.width.toString(),
          height: productData.height.toString(),
          dimensionUnit: productData.dimension_unit,
          nutrients: productData.nutrients || [],
          categories: productData.categories || [],
          existingProductPhotoUrls: productData.product_photo_urls || [],
          existingProductVideoUrl: productData.product_video_url || null,
        }
        setInitialProductData(mappedData)
      }
      setPageLoading(false)
    }

    fetchProductAndAuth()
  }, [id, router, toast])

  // General file upload function for Supabase Storage
  const uploadFile = async (file: File, bucketName: string, folder: string, companyId: string) => {
    const uniqueFileName = `${folder}/${companyId}/${file.name}-${crypto.randomUUID()}`
    const { data, error } = await supabase.storage.from(bucketName).upload(uniqueFileName, file, {
      cacheControl: "3600",
      upsert: false,
    })

    if (error) {
      throw error
    }

    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(uniqueFileName)
    return publicUrlData.publicUrl
  }

  const handleSaveProduct = async (
    data: ProductFormData,
    newImages: File[],
    newVideo: File | null,
    removedImageUrls: string[],
  ) => {
    setIsSaving(true)
    setSubmissionError("")

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      setSubmissionError("Authentication required to save changes.")
      setIsSaving(false)
      return
    }

    const userId = session.user.id
    const { data: companyData } = await supabase.from("companies").select("id").eq("user_id", userId).single()

    if (!companyData?.id) {
      setSubmissionError("Company ID not found. Cannot save product.")
      setIsSaving(false)
      return
    }
    const companyId = companyData.id

    try {
      // 1. Delete removed images from storage
      const deleteImagePromises = removedImageUrls.map((url) => {
        const path = url.split("product-media/")[1] // Extract path after bucket name
        return supabase.storage.from("product-media").remove([path])
      })
      await Promise.all(deleteImagePromises)

      // 2. Upload new images
      const uploadImagePromises = newImages.map((file) => uploadFile(file, "product-media", "images", companyId))
      const newProductPhotoUrls = await Promise.all(uploadImagePromises)

      // Combine existing (not removed) and new image URLs
      const finalProductPhotoUrls = [
        ...(initialProductData?.existingProductPhotoUrls?.filter((url) => !removedImageUrls.includes(url)) || []),
        ...newProductPhotoUrls,
      ]

      // 3. Handle video upload/removal
      let finalProductVideoUrl: string | null = initialProductData?.existingProductVideoUrl || null
      if (newVideo) {
        // If a new video is selected, upload it and replace the old one
        finalProductVideoUrl = await uploadFile(newVideo, "product-media", "videos", companyId)
        // Optionally, delete the old video from storage if it existed
        if (initialProductData?.existingProductVideoUrl) {
          const oldVideoPath = initialProductData.existingProductVideoUrl.split("product-media/")[1]
          await supabase.storage.from("product-media").remove([oldVideoPath])
        }
      } else if (newVideo === null && initialProductData?.existingProductVideoUrl) {
        // If video was explicitly removed (selectedVideo is null and there was an existing one)
        const oldVideoPath = initialProductData.existingProductVideoUrl.split("product-media/")[1]
        await supabase.storage.from("product-media").remove([oldVideoPath])
        finalProductVideoUrl = null
      }

      // Prepare product data for Supabase update.
      const productUpdateData = {
        product_name: data.productName,
        product_description: data.productDescription,
        original_price: Number.parseFloat(data.originalPrice),
        discount_price: Number.parseFloat(data.discountPrice),
        stock_quantity: Number.parseInt(data.stockQuantity, 10),
        weight: Number.parseFloat(data.weight),
        weight_unit: data.weightUnit,
        length: Number.parseFloat(data.length),
        width: Number.parseFloat(data.width),
        height: Number.parseFloat(data.height),
        dimension_unit: data.dimensionUnit,
        nutrients: data.nutrients,
        categories: data.categories,
        product_photo_urls: finalProductPhotoUrls,
        product_video_url: finalProductVideoUrl,
        // is_approved status should generally not be changed by the company user
        // is_approved: false, // Keep current status or set to pending if major changes
      }

      // Update product data in Supabase.
      const { error: dbError } = await supabase
        .from("products")
        .update(productUpdateData)
        .eq("id", id)
        .eq("company_id", companyId) // Ensure only own product is updated

      if (dbError) {
        throw dbError
      }

      toast({
        title: "Success!",
        description: "Product updated successfully.",
        variant: "default",
      })
      router.push("/company/dashboard/my-products") // Redirect to my products page
    } catch (error: any) {
      console.error("Error updating product:", error)
      setSubmissionError(error.message || "Error updating product. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-green-600" />
        <span className="ml-3 text-lg text-green-700">Loading product details...</span>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <Alert variant="destructive" className="max-w-md w-full">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{fetchError}</AlertDescription>
          <Button onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-yellow-100">
      {/* Professional Top Navbar */}
      <nav className="w-full h-16 px-6 flex items-center bg-gradient-to-r from-blue-100 via-green-50 to-green-100 shadow-sm rounded-b-2xl mb-8 font-[Inter,sans-serif]">
        <div className="flex items-center gap-3">
          <Edit className="h-7 w-7 text-yellow-500" />
          <span className="text-xl md:text-2xl font-semibold tracking-tight text-gray-800">Edit Product</span>
        </div>
      </nav>
      <div className="container mx-auto px-4 py-8">
        {submissionError && (
          <Alert variant="destructive" className="mb-4 rounded-xl shadow-md bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <AlertDescription className="text-red-700">{submissionError}</AlertDescription>
          </Alert>
        )}
        {initialProductData && (
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full border border-yellow-100">
            <AddEditProductForm
              initialProductData={initialProductData}
              onSave={handleSaveProduct}
              isEditMode={true}
              isLoading={isSaving}
            />
          </div>
        )}
      </div>
    </div>
  )
}