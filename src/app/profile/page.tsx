"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, User, ShoppingBag, Heart, Package, MapPin, Plus, Edit, Trash2, CheckCircle2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { v4 as uuidv4 } from "uuid"
import { Checkbox } from "@/components/ui/checkbox" // Import Checkbox

interface Address {
  id: string
  name: string // e.g., "Home", "Office"
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

interface UserProfile {
  id: string
  email: string
  name: string | null
  phone: string | null
  addresses: Address[] | null
}

export default function ProfilePage() {
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [orderCount, setOrderCount] = useState(0)
  const [cartCount, setCartCount] = useState(0)
  const [favCount, setFavCount] = useState(0)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [isAddingAddress, setIsAddingAddress] = useState(false)
  const [editingAddress, setEditingAddress] = useState<Address | null>(null)

  // Profile edit states
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editPhone, setEditPhone] = useState("")

  // Address form states
  const [addressName, setAddressName] = useState("")
  const [houseNumber, setHouseNumber] = useState("")
  const [street, setStreet] = useState("")
  const [area, setArea] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [pincode, setPincode] = useState("")
  const [country, setCountry] = useState("India")
  const [addressPrimaryPhone, setAddressPrimaryPhone] = useState("")
  const [addressSecondaryPhone, setAddressSecondaryPhone] = useState("")
  const [isDefaultAddress, setIsDefaultAddress] = useState(false)

  const fetchProfileData = useCallback(async () => {
    setLoading(true)
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      toast({
        title: "Please log in to view your profile.",
        variant: "destructive",
      })
      router.push("/login")
      setLoading(false)
      return
    }

    const userId = session.user.id

    // Fetch user profile
    const { data: profileData, error: profileError } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .single()

    if (profileError && profileError.code !== "PGRST116") {
      toast({
        title: "Failed to load profile data.",
        variant: "destructive",
      })
      setLoading(false)
      return
    }

    setProfile(profileData || null)
    setEditName(profileData?.name || "")
    setEditEmail(profileData?.email || "")
    setEditPhone(profileData?.phone || "")

    // Fetch counts
    const { count: ordersCount, error: ordersError } = await supabase
      .from("orders")
      .select("id", { count: "exact" })
      .eq("user_id", userId)
    setOrderCount(ordersCount || 0)

    const { count: cartItemsCount, error: cartError } = await supabase
      .from("cart_items")
      .select("id", { count: "exact" })
      .eq("user_id", userId)
    setCartCount(cartItemsCount || 0)

    const { count: favItemsCount, error: favError } = await supabase
      .from("favorites")
      .select("id", { count: "exact" })
      .eq("user_id", userId)
    setFavCount(favItemsCount || 0)

    setLoading(false)
  }, [router, toast])

  useEffect(() => {
    fetchProfileData()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push("/login")
      } else {
        fetchProfileData()
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [fetchProfileData, router])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({ name: editName, phone: editPhone })
        .eq("id", profile.id)

      if (error) throw error

      toast({
        title: "Your profile details have been saved.",
        variant: "default",
      })
      setIsEditingProfile(false)
      fetchProfileData()
    } catch (error: any) {
      toast({
        title: error.message || "Failed to update profile.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddOrUpdateAddress = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    setLoading(true)
    try {
      let updatedAddresses = profile.addresses ? [...profile.addresses] : []

      const newAddress: Address = {
        id: editingAddress?.id || uuidv4(),
        name: addressName,
        houseNumber,
        street,
        area,
        city,
        state,
        pincode,
        country,
        primaryPhone: addressPrimaryPhone,
        secondaryPhone: addressSecondaryPhone || undefined,
        isDefault: isDefaultAddress,
      }

      if (isDefaultAddress) {
        updatedAddresses = updatedAddresses.map((addr) => ({ ...addr, isDefault: false }))
      }

      if (editingAddress) {
        updatedAddresses = updatedAddresses.map((addr) => (addr.id === newAddress.id ? newAddress : addr))
      } else {
        updatedAddresses.push(newAddress)
      }

      const { error } = await supabase
        .from("user_profiles")
        .update({ addresses: updatedAddresses })
        .eq("id", profile.id)

      if (error) throw error

      toast({
        title: "Your address has been successfully saved.",
        variant: "default",
      })
      setIsAddingAddress(false)
      setEditingAddress(null)
      resetAddressForm()
      fetchProfileData()
    } catch (error: any) {
      toast({
        title: error.message || "Failed to save address.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAddress = async (addressId: string) => {
    if (!profile || !profile.addresses) return

    setLoading(true)
    try {
      const updatedAddresses = profile.addresses.filter((addr) => addr.id !== addressId)

      const { error } = await supabase
        .from("user_profiles")
        .update({ addresses: updatedAddresses })
        .eq("id", profile.id)

      if (error) throw error

      toast({
        title: "The address has been removed.",
        variant: "default",
      })
      fetchProfileData()
    } catch (error: any) {
      toast({
        title: error.message || "Failed to delete address.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Removed handleSetDefaultAddress as per user request

  const resetAddressForm = () => {
    setAddressName("")
    setHouseNumber("")
    setStreet("")
    setArea("")
    setCity("")
    setState("")
    setPincode("")
    setCountry("India")
    setAddressPrimaryPhone("")
    setAddressSecondaryPhone("")
    setIsDefaultAddress(false)
  }

  const openEditAddressForm = (address: Address) => {
    setEditingAddress(address)
    setAddressName(address.name)
    setHouseNumber(address.houseNumber)
    setStreet(address.street)
    setArea(address.area)
    setCity(address.city)
    setState(address.state)
    setPincode(address.pincode)
    setCountry(address.country)
    setAddressPrimaryPhone(address.primaryPhone)
    setAddressSecondaryPhone(address.secondaryPhone || "")
    setIsDefaultAddress(address.isDefault)
    setIsAddingAddress(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header showSearchBar={false} />
        <main className="flex-grow container mx-auto px-4 py-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-3 text-lg text-blue-700">Loading profile...</span>
        </main>
        <Footer />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header showSearchBar={false} />
        <main className="flex-grow container mx-auto px-4 py-8 flex items-center justify-center">
          <Card className="p-8 text-center">
            <h1 className="text-2xl font-bold mb-4">Profile Not Found</h1>
            <p className="text-gray-600 mb-6">Please ensure you are logged in.</p>
            <Button onClick={() => router.push("/login")}>Go to Login</Button>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header showSearchBar={false} />
      <main className="flex-grow container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6 text-gray-900">My Profile</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Overview */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" /> Personal Details
                </CardTitle>
                <CardDescription>Manage your account information.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditingProfile ? (
                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div>
                      <Label htmlFor="editName">Name</Label>
                      <Input id="editName" value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="editEmail">Email</Label>
                      <Input id="editEmail" value={editEmail} disabled className="bg-gray-100" />
                    </div>
                    <div>
                      <Label htmlFor="editPhone">Phone Number</Label>
                      <Input id="editPhone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Changes"}
                      </Button>
                      <Button variant="outline" onClick={() => setIsEditingProfile(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Name:</span> {profile.name || "N/A"}
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Email:</span> {profile.email}
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Phone:</span> {profile.phone || "N/A"}
                    </p>
                    <Button variant="outline" onClick={() => setIsEditingProfile(true)} className="mt-4">
                      <Edit className="h-4 w-4 mr-2" /> Edit Profile
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">Your Activity</CardTitle>
                <CardDescription>Overview of your interactions.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <ShoppingBag className="h-6 w-6 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold">{orderCount}</p>
                    <p className="text-sm text-gray-600">Orders</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Package className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold">{cartCount}</p>
                    <p className="text-sm text-gray-600">In Cart</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Heart className="h-6 w-6 text-red-600" />
                  <div>
                    <p className="text-2xl font-bold">{favCount}</p>
                    <p className="text-sm text-gray-600">Favorites</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Addresses Section */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" /> My Addresses
                  </CardTitle>
                  <CardDescription>Manage your delivery addresses.</CardDescription>
                </div>
                <Button
                  onClick={() => {
                    setIsAddingAddress(true)
                    setEditingAddress(null)
                    resetAddressForm()
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" /> Add New Address
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {isAddingAddress || editingAddress ? (
                  <form onSubmit={handleAddOrUpdateAddress} className="space-y-4 p-4 border rounded-lg bg-gray-50">
                    <h3 className="text-lg font-semibold mb-4">
                      {editingAddress ? "Edit Address" : "Add New Address"}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="addressName">Address Name (e.g., Home, Office) *</Label>
                        <Input
                          id="addressName"
                          value={addressName}
                          onChange={(e) => setAddressName(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="houseNumber">House/Flat Number *</Label>
                        <Input
                          id="houseNumber"
                          value={houseNumber}
                          onChange={(e) => setHouseNumber(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="street">Street/Road Name *</Label>
                        <Input id="street" value={street} onChange={(e) => setStreet(e.target.value)} required />
                      </div>
                      <div>
                        <Label htmlFor="area">Area/Locality *</Label>
                        <Input id="area" value={area} onChange={(e) => setArea(e.target.value)} required />
                      </div>
                      <div>
                        <Label htmlFor="city">City *</Label>
                        <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} required />
                      </div>
                      <div>
                        <Label htmlFor="state">State *</Label>
                        <Input id="state" value={state} onChange={(e) => setState(e.target.value)} required />
                      </div>
                      <div>
                        <Label htmlFor="pincode">Pincode *</Label>
                        <Input id="pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} required />
                      </div>
                      <div>
                        <Label htmlFor="country">Country *</Label>
                        <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} required />
                      </div>
                      <div>
                        <Label htmlFor="addressPrimaryPhone">Primary Phone Number *</Label>
                        <Input
                          id="addressPrimaryPhone"
                          value={addressPrimaryPhone}
                          onChange={(e) => setAddressPrimaryPhone(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="addressSecondaryPhone">Secondary Phone Number (Optional)</Label>
                        <Input
                          id="addressSecondaryPhone"
                          value={addressSecondaryPhone}
                          onChange={(e) => setAddressSecondaryPhone(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 mt-4">
                      <Checkbox
                        id="isDefaultAddress"
                        checked={isDefaultAddress}
                        onCheckedChange={(checked: boolean) => setIsDefaultAddress(checked)}
                      />
                      <Label htmlFor="isDefaultAddress">Set as default address</Label>
                    </div>
                    <div className="flex gap-2 mt-6">
                      <Button type="submit" disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Address"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsAddingAddress(false)
                          setEditingAddress(null)
                          resetAddressForm()
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    {profile.addresses && profile.addresses.length > 0 ? (
                      <div className="space-y-4">
                        {profile.addresses.map((addr) => (
                          <div key={addr.id} className="border rounded-lg p-4 relative">
                            {/* <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold text-gray-900 text-lg">{addr.name}</h4>
                              {addr.isDefault && (
                                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Default
                                </span>
                              )}
                            </div> */}
                            <p className="text-sm text-gray-700">
                              {addr.houseNumber}, {addr.street}
                            </p>
                            <p className="text-sm text-gray-700">
                              {addr.area}, {addr.city} - {addr.pincode}
                            </p>
                            <p className="text-sm text-gray-700">
                              {addr.state}, {addr.country}
                            </p>
                            <p className="text-sm text-gray-700 mt-1">
                              Phone: {addr.primaryPhone} {addr.secondaryPhone && `(${addr.secondaryPhone})`}
                            </p>
                            <div className="absolute top-4 right-4 flex gap-2">
                              {/* Removed "Set as default" button as per user request */}
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 bg-transparent"
                                onClick={() => openEditAddressForm(addr)}
                                title="Edit address"
                              >
                                <Edit className="h-4 w-4" />
                                <span className="sr-only">Edit address</span>
                              </Button>
                              <Button
                                variant="destructive"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleDeleteAddress(addr.id)}
                                title="Delete address"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Delete address</span>
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <MapPin className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                        <p className="text-lg font-medium mb-2">No addresses saved yet.</p>
                        <p className="text-sm">Add your first address to make checkout faster!</p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
