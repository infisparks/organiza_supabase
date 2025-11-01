"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, X, MapPin, User, Phone, Globe, Home, Building } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import RazorpayPayment from "./razorpay-payment" // Assuming this component exists
import { v4 as uuidv4 } from "uuid" // Import uuid for address IDs
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator" // Import Separator for professional look

interface CheckoutItem {
  productId: string
  productName: string
  quantity: number
  price_at_add: number
}

interface CheckoutDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  items: CheckoutItem[]
  onOrderSuccess: () => void // Callback to clear cart etc.
}

// Define the Address interface here for now
interface Address {
  id: string
  name: string
  houseNumber: string
  street: string
  area: string
  city: string
  state: string
  pincode: string
  country: string
  primaryPhone: string
  secondaryPhone?: string
  isDefault: boolean
  lat?: number
  lng?: number
}

export default function CheckoutDetailsModal({ isOpen, onClose, items, onOrderSuccess }: CheckoutDetailsModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRazorpay, setShowRazorpay] = useState(false)
  const [orderId, setOrderId] = useState("") // Internal order ID before Razorpay provides one

  // Form states
  const [userName, setUserName] = useState("")
  const [primaryPhone, setPrimaryPhone] = useState("")
  const [secondaryPhone, setSecondaryPhone] = useState("")
  const [country, setCountry] = useState("India") // Default to India
  const [state, setState] = useState("")
  const [city, setCity] = useState("")
  const [pincode, setPincode] = useState("")
  const [area, setArea] = useState("")
  const [street, setStreet] = useState("")
  const [houseNumber, setHouseNumber] = useState("")
  const [userEmail, setUserEmail] = useState("") // To prefill Razorpay

  // State for managing addresses in the modal
  const [userAddresses, setUserAddresses] = useState<Address[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [showNewAddressForm, setShowNewAddressForm] = useState(false)

  const subtotal = items.reduce((sum, item) => sum + item.price_at_add * item.quantity, 0)
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0) // Calculate total quantity
  const shippingFee = subtotal > 0 && subtotal < 1000 ? 99 : 0 // Example: Free shipping over ₹1000
  const totalAmount = subtotal + shippingFee

  // Fetch user profile data to prefill form and addresses
  useEffect(() => {
    const fetchUserProfile = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const userId = session?.user?.id

      if (userId) {
        const { data: profile, error: profileError } = await supabase
          .from("user_profiles")
          .select("name, email, phone, addresses") // Fetch the new 'addresses' column
          .eq("id", userId)
          .single()

        if (profileError && profileError.code !== "PGRST116") {
          console.error("Error fetching user profile:", profileError)
        } else if (profile) {
          setUserName(profile.name || "")
          setUserEmail(profile.email || "")
          setPrimaryPhone(profile.phone || "")

          if (profile.addresses && profile.addresses.length > 0) {
            setUserAddresses(profile.addresses)
            const defaultAddress = profile.addresses.find((addr: Address) => addr.isDefault) || profile.addresses[0]
            setSelectedAddressId(defaultAddress.id)
            // Prefill form with default/first address
            setHouseNumber(defaultAddress.houseNumber || "")
            setStreet(defaultAddress.street || "")
            setArea(defaultAddress.area || "")
            setCity(defaultAddress.city || "")
            setState(defaultAddress.state || "")
            setPincode(defaultAddress.pincode || "")
            setCountry(defaultAddress.country || "India")
            setPrimaryPhone(defaultAddress.primaryPhone || profile.phone || "")
            setSecondaryPhone(defaultAddress.secondaryPhone || "")
            setShowNewAddressForm(false) // Hide new address form if existing addresses
          } else {
            // If no addresses, show new address form by default
            setShowNewAddressForm(true)
            setSelectedAddressId("new")
          }
        }
      }
    }
    if (isOpen) {
      fetchUserProfile()
    }
  }, [isOpen])

  // Helper: fetch current geolocation.
  const getCurrentLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            })
          },
          (error) => reject(error),
        )
      } else {
        reject(new Error("Geolocation is not supported by this browser."))
      }
    })
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (
      selectedAddressId === "new" &&
      (!userName || !primaryPhone || !state || !city || !pincode || !houseNumber || !street || !area)
    ) {
      setError("Please fill in all required shipping details for the new address.")
      toast({
        title: "Missing Details",
        description: "Please fill in all required shipping details.",
        variant: "destructive",
      })
      return
    }

    if (!selectedAddressId) {
      setError("Please select or add a delivery address.")
      toast({
        title: "Missing Address",
        description: "Please select or add a delivery address.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    // Generate a unique order ID (for internal tracking before Razorpay provides one)
    const tempOrderId = `order_${Date.now()}_${Math.floor(Math.random() * 1000)}`
    setOrderId(tempOrderId)
    setShowRazorpay(true)
    setLoading(false)
  }

  const handlePaymentSuccess = async (response: any) => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const currentUserId = session?.user?.id

    if (!currentUserId) {
      toast({
        title: "Authentication Error",
        description: "User not logged in. Please log in and try again.",
        variant: "destructive",
      })
      return
    }

    try {
      // Auto fetch current location
      const location = await getCurrentLocation().catch(() => ({ lat: 0, lng: 0 }))

      let currentShippingAddress: Address | undefined
      let updatedAddressesForProfile: Address[] = [...userAddresses]

      // Handle new address creation/update
      if (selectedAddressId === "new") {
        const newAddress: Address = {
          id: uuidv4(),
          name: `${houseNumber}, ${street}`, // A simple name for the new address
          houseNumber,
          street,
          area,
          city,
          state,
          pincode,
          country,
          primaryPhone,
          secondaryPhone: secondaryPhone || undefined,
          isDefault: true, // New address is set as default
          lat: location.lat,
          lng: location.lng,
        }

        // Clear existing defaults and add the new address
        updatedAddressesForProfile = updatedAddressesForProfile.map((addr) => ({ ...addr, isDefault: false }))
        updatedAddressesForProfile.push(newAddress)
        currentShippingAddress = newAddress
      } else {
        currentShippingAddress = userAddresses.find((addr) => addr.id === selectedAddressId)
        // If an existing address was selected, ensure it's marked as default
        if (currentShippingAddress) {
          updatedAddressesForProfile = userAddresses.map((addr) => ({
            ...addr,
            isDefault: addr.id === selectedAddressId,
          }))
        }
      }

      if (!currentShippingAddress) {
        throw new Error("No shipping address found or selected.")
      }

      // Update user profile with latest shipping details in the 'addresses' JSONB array
      const { error: profileUpdateError } = await supabase
        .from("user_profiles")
        .update({
          name: userName, // Also update user's main name
          phone: primaryPhone, // Also update user's main phone
          addresses: updatedAddressesForProfile, // Save the updated addresses array
        })
        .eq("id", currentUserId)

      if (profileUpdateError) {
        console.error("Error updating user profile after purchase:", profileUpdateError)
        // Don't throw, as the purchase itself was successful
      }

      // Prepare order items data from the current `items` prop
      const orderItemsData = items.map((item) => ({
        id: uuidv4(), // Generate unique ID for each order item
        product_id: item.productId,
        quantity: item.quantity,
        price_at_purchase: item.price_at_add,
        created_at: new Date().toISOString(),
      }))

      // Prepare order data for Supabase
      const orderData = {
        user_id: currentUserId,
        total_amount: totalAmount,
        payment_id: response.razorpay_payment_id || null,
        order_id: response.razorpay_order_id || orderId, // Use Razorpay order_id if available, else fallback to tempOrderId
        signature: response.razorpay_signature || null,
        status: "confirmed",
        purchase_time: new Date().toISOString(),
        customer_name: userName,
        primary_phone: primaryPhone,
        secondary_phone: secondaryPhone || null,
        country: currentShippingAddress.country,
        state: currentShippingAddress.state,
        city: currentShippingAddress.city,
        pincode: currentShippingAddress.pincode,
        area: currentShippingAddress.area,
        street: currentShippingAddress.street,
        house_number: currentShippingAddress.houseNumber,
        location: { lat: currentShippingAddress.lat, lng: currentShippingAddress.lng },
        order_items: orderItemsData, // Store order items directly in the orders table
      }

      // Insert order data into Supabase
      const { data: newOrder, error: orderError } = await supabase.from("orders").insert([orderData]).select().single()

      if (orderError || !newOrder) {
        throw orderError || new Error("Failed to create order record.")
      }

      toast({
        title: "Payment successful!",
        description: "Your order has been placed.",
        variant: "default",
      })
      setShowRazorpay(false)
      onClose() // Close the modal
      onOrderSuccess() // Trigger callback to clear cart etc.
    } catch (err: any) {
      console.error("Error creating order:", err)
      toast({
        title: "Order Error",
        description:
          err.message || "Payment was successful, but there was an error creating your order. Please contact support.",
        variant: "destructive",
      })
      setShowRazorpay(false)
    }
  }

  const handlePaymentFailure = (err: any) => {
    console.error("Payment failed:", err)
    toast({
      title: "Payment Failed",
      description: `Payment failed: ${err.description || "Unknown error"}`,
      variant: "destructive",
    })
    setShowRazorpay(false)
  }

  const handleAddressSelectionChange = (value: string) => {
    setSelectedAddressId(value)
    if (value === "new") {
      setShowNewAddressForm(true)
      // Clear form fields for new address
      setHouseNumber("")
      setStreet("")
      setArea("")
      setCity("")
      setState("")
      setPincode("")
      setCountry("India")
      setSecondaryPhone("")
    } else {
      setShowNewAddressForm(false)
      const selected = userAddresses.find((addr) => addr.id === value)
      if (selected) {
        setHouseNumber(selected.houseNumber || "")
        setStreet(selected.street || "")
        setArea(selected.area || "")
        setCity(selected.city || "")
        setState(selected.state || "")
        setPincode(selected.pincode || "")
        setCountry(selected.country || "India")
        setPrimaryPhone(selected.primaryPhone || "")
        setSecondaryPhone(selected.secondaryPhone || "")
      }
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center">
          <DialogTitle className="text-2xl font-bold text-gray-900">Complete Your Order</DialogTitle>
          <DialogDescription className="text-gray-600">
            Please provide your shipping details to proceed with payment.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm p-3 bg-red-50 rounded-md border border-red-200">
            <X className="h-4 w-4" />
            {error}
          </div>
        )}
        <form onSubmit={handleFormSubmit} className="space-y-6 mt-4">
          {/* Contact Details - always visible */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="userName">Full Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  id="userName"
                  type="text"
                  placeholder="John Doe"
                  value={userName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUserName(e.target.value)}
                  required
                  className="pl-10 h-11"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="primaryPhone">Primary Phone Number *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  id="primaryPhone"
                  type="tel"
                  placeholder="9876543210"
                  value={primaryPhone}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrimaryPhone(e.target.value)}
                  required
                  className="pl-10 h-11"
                />
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="secondaryPhone">Secondary Phone Number (Optional)</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  id="secondaryPhone"
                  type="tel"
                  placeholder="Optional"
                  value={secondaryPhone}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSecondaryPhone(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
            </div>
          </div>

          {/* Address Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Delivery Address</h3>
            {userAddresses.length > 0 && (
              <RadioGroup onValueChange={handleAddressSelectionChange} value={selectedAddressId || ""}>
                <div className="grid grid-cols-1 gap-3">
                  {userAddresses.map((address) => (
                    <Label
                      key={address.id}
                      htmlFor={`address-${address.id}`}
                      className="flex items-center space-x-2 p-3 border rounded-md cursor-pointer hover:bg-gray-50"
                    >
                      <RadioGroupItem value={address.id} id={`address-${address.id}`} />
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {address.name} {address.isDefault && "(Default)"}
                        </span>
                        <span className="text-sm text-gray-600">
                          {address.houseNumber}, {address.street}, {address.area}, {address.city}, {address.state} -{" "}
                          {address.pincode}, {address.country}
                        </span>
                        <span className="text-sm text-gray-600">Phone: {address.primaryPhone}</span>
                      </div>
                    </Label>
                  ))}
                  <Label
                    htmlFor="address-new"
                    className="flex items-center space-x-2 p-3 border rounded-md cursor-pointer hover:bg-gray-50"
                  >
                    <RadioGroupItem value="new" id="address-new" />
                    <span className="font-medium">Add New Address</span>
                  </Label>
                </div>
              </RadioGroup>
            )}
            {userAddresses.length === 0 && (
              <p className="text-sm text-gray-500">No saved addresses. Please add a new one below.</p>
            )}
          </div>

          {/* New Address Form - conditionally rendered */}
          {(showNewAddressForm || userAddresses.length === 0) && (
            <div className="space-y-4 border-t pt-4 mt-4">
              <h4 className="text-md font-semibold text-gray-800">New Address Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="houseNumber">House/Flat Number *</Label>
                  <div className="relative">
                    <Home className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                      id="houseNumber"
                      type="text"
                      placeholder="A-101"
                      value={houseNumber}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHouseNumber(e.target.value)}
                      required
                      className="pl-10 h-11"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="street">Street/Road Name *</Label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                      id="street"
                      type="text"
                      placeholder="SV Road"
                      value={street}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStreet(e.target.value)}
                      required
                      className="pl-10 h-11"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="area">Area/Locality *</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                      id="area"
                      type="text"
                      placeholder="Andheri West"
                      value={area}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setArea(e.target.value)}
                      required
                      className="pl-10 h-11"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                      id="city"
                      type="text"
                      placeholder="Mumbai"
                      value={city}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCity(e.target.value)}
                      required
                      className="pl-10 h-11"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State *</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                      id="state"
                      type="text"
                      placeholder="Maharashtra"
                      value={state}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setState(e.target.value)}
                      required
                      className="pl-10 h-11"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode *</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                      id="pincode"
                      type="text"
                      placeholder="400001"
                      value={pincode}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPincode(e.target.value)}
                      required
                      className="pl-10 h-11"
                    />
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="country">Country *</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                      id="country"
                      type="text"
                      placeholder="India"
                      value={country}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCountry(e.target.value)}
                      required
                      className="pl-10 h-11"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2 md:col-span-2">
                  <Checkbox
                    id="set-default-address"
                    checked={selectedAddressId === "new"} // If new address is selected, it's implicitly default for this transaction
                    onCheckedChange={(checked: boolean) => {
                      if (checked) {
                        setSelectedAddressId("new")
                      } else if (userAddresses.length > 0) {
                        setSelectedAddressId(userAddresses[0].id) // Revert to first existing if unchecked
                      } else {
                        setSelectedAddressId(null)
                      }
                    }}
                  />
                  <Label htmlFor="set-default-address">Set as Default Address</Label>
                </div>
              </div>
            </div>
          )}

          {/* 🎯 Order Summary in Modal - Updated for detailed item breakdown */}
          <div className="bg-gray-50 p-6 rounded-lg border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Summary ({items.length} unique items)</h3>
            
            {/* Item Breakdown */}
            <div className="space-y-2 text-sm mb-4 max-h-40 overflow-y-auto pr-2">
              <div className="flex font-semibold text-gray-600 border-b pb-1">
                <span className="w-1/2">Product</span>
                <span className="w-1/4 text-center">Qty</span>
                <span className="w-1/4 text-right">Total</span>
              </div>
              {items.map((item, index) => (
                <div key={index} className="flex justify-between text-gray-700">
                  <span className="w-1/2 truncate pr-2">
                    {item.productName} 
                    <span className="text-xs text-gray-500 block">
                      @ ₹{item.price_at_add.toFixed(2)} ea.
                    </span>
                  </span>
                  <span className="w-1/4 text-center">x{item.quantity}</span>
                  <span className="w-1/4 text-right font-medium">
                    ₹{(item.price_at_add * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            
            <Separator className="my-3" />

            {/* Final Totals */}
            <div className="space-y-2 text-gray-700">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping Fee</span>
                <span>{shippingFee === 0 ? "Free" : `₹${shippingFee.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between font-bold text-xl text-gray-900 pt-2 border-t border-gray-200">
                <span>Total Payable</span>
                <span>₹{totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full h-11 bg-green-600 hover:bg-green-700" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {loading ? "Processing..." : `Proceed to Payment (₹${totalAmount.toFixed(2)})`}
          </Button>
        </form>
      </DialogContent>

      {showRazorpay && (
        <RazorpayPayment
          amount={totalAmount}
          name={userName || "Customer"}
          description={`Order from Organixa`}
          image="/placeholder.svg" // Use a generic logo or company logo
          prefill={{
            name: userName || undefined,
            email: userEmail || undefined,
            contact: primaryPhone || undefined,
          }}
          onSuccess={handlePaymentSuccess}
          onFailure={handlePaymentFailure}
        />
      )}
    </Dialog>
  )
}