"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { v4 as uuidv4 } from "uuid" // Import uuid for address IDs

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

interface AuthPopupProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  mode?: "auth" | "profile_completion" // New prop to control mode
  initialEmail?: string // For pre-filling email in profile completion
}

export default function AuthPopup({ isOpen, onClose, onSuccess, mode = "auth", initialEmail = "" }: AuthPopupProps) {
  const [currentMode, setCurrentMode] = useState(mode) // Internal state for mode
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  // Profile completion form states
  const [profileName, setProfileName] = useState("")
  const [profilePhone, setProfilePhone] = useState("")
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

  useEffect(() => {
    setCurrentMode(mode)
    if (mode === "profile_completion" && initialEmail) {
      setEmail(initialEmail)
    }
  }, [mode, initialEmail])

  const checkAndTransitionToProfileCompletion = async (userId: string) => {
    const { data: profileData, error: profileError } = await supabase
      .from("user_profiles")
      .select("name, phone, email")
      .eq("id", userId)
      .single()

    if (profileError && profileError.code !== "PGRST116") {
      console.error("Error fetching profile for completion check:", profileError)
      setError("Failed to check profile status.")
      return false
    }

    // If profile doesn't exist, create a basic one
    if (!profileData) {
      const { error: insertError } = await supabase
        .from("user_profiles")
        .insert({ id: userId, email: email || initialEmail })
      if (insertError) {
        console.error("Error creating initial profile:", insertError)
        setError("Failed to create initial profile.")
        return false
      }
      setCurrentMode("profile_completion")
      return true
    }

    // If name or phone is missing, transition to profile completion
    if (!profileData.name || !profileData.phone) {
      setProfileName(profileData.name || "")
      setProfilePhone(profileData.phone || "")
      setCurrentMode("profile_completion")
      return true
    }
    return false
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError

      const needsCompletion = await checkAndTransitionToProfileCompletion(data.user!.id)
      if (!needsCompletion) {
        toast({
          title: "Logged in successfully!",
          description: "Welcome back.",
          variant: "default",
        })
        onSuccess()
      }
    } catch (err: any) {
      setError(err.message || "Login failed. Please check your credentials.")
      toast({
        title: "Login Failed",
        description: err.message || "Please check your credentials.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) throw signUpError

      // For new registrations, ensure a profile entry exists and then prompt for completion
      const needsCompletion = await checkAndTransitionToProfileCompletion(data.user!.id)
      if (!needsCompletion) {
        // This path should ideally not be hit for new sign-ups if profile is always incomplete initially
        toast({
          title: "Registration successful!",
          description: "Please check your email to confirm your account.",
          variant: "default",
        })
        onSuccess()
      } else {
        toast({
          title: "Registration successful!",
          description: "Please complete your profile details.",
          variant: "default",
        })
      }
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.")
      toast({
        title: "Registration Failed",
        description: err.message || "Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      setError("No active session found. Please log in again.")
      setLoading(false)
      return
    }

    const userId = session.user.id
    let updatedAddresses: Address[] = []

    try {
      // Fetch current profile to merge addresses
      const { data: currentProfile, error: fetchProfileError } = await supabase
        .from("user_profiles")
        .select("addresses")
        .eq("id", userId)
        .single()

      if (fetchProfileError && fetchProfileError.code !== "PGRST116") {
        throw fetchProfileError
      }

      updatedAddresses = currentProfile?.addresses || []

      if (addressName && houseNumber && street && area && city && state && pincode && country && addressPrimaryPhone) {
        const newAddress: Address = {
          id: uuidv4(),
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
        updatedAddresses.push(newAddress)
      }

      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({
          name: profileName,
          phone: profilePhone,
          addresses: updatedAddresses,
        })
        .eq("id", userId)

      if (updateError) throw updateError

      toast({
        title: "Profile Completed!",
        description: "Your profile details have been saved.",
        variant: "default",
      })
      onSuccess() // Call the success callback to close the modal or redirect
    } catch (err: any) {
      setError(err.message || "Failed to complete profile. Please try again.")
      toast({
        title: "Profile Completion Failed",
        description: err.message || "Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] p-6">
        <DialogHeader className="text-center">
          <DialogTitle className="text-2xl font-bold">
            {currentMode === "auth" ? "Welcome to Organixa" : "Complete Your Profile"}
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            {currentMode === "auth"
              ? "Login or create an account to continue."
              : "Please provide your basic details to continue."}
          </DialogDescription>
        </DialogHeader>

        {currentMode === "auth" ? (
          <Tabs value="login" onValueChange={setEmail} className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="mt-4">
              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 text-red-600 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="m@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {loading ? "Logging in..." : "Login"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="register" className="mt-4">
              <form onSubmit={handleRegister} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 text-red-600 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="m@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Password</Label>
                  <Input
                    id="register-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {loading ? "Registering..." : "Register"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        ) : (
          <form onSubmit={handleCompleteProfile} className="space-y-4 mt-4">
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="profileName">Full Name *</Label>
              <Input id="profileName" value={profileName} onChange={(e) => setProfileName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profilePhone">Phone Number *</Label>
              <Input
                id="profilePhone"
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profileEmail">Email</Label>
              <Input id="profileEmail" value={email} disabled className="bg-gray-100" />
            </div>

            <h3 className="text-lg font-semibold mt-6 mb-2">Optional: Add an Address</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="addressName">Address Name (e.g., Home, Office)</Label>
                <Input id="addressName" value={addressName} onChange={(e) => setAddressName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="houseNumber">House/Flat Number</Label>
                <Input id="houseNumber" value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="street">Street/Road Name</Label>
                <Input id="street" value={street} onChange={(e) => setStreet(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="area">Area/Locality</Label>
                <Input id="area" value={area} onChange={(e) => setArea(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input id="state" value={state} onChange={(e) => setState(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pincode">Pincode</Label>
                <Input id="pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="addressPrimaryPhone">Primary Phone Number (for address)</Label>
                <Input
                  id="addressPrimaryPhone"
                  value={addressPrimaryPhone}
                  onChange={(e) => setAddressPrimaryPhone(e.target.value)}
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
              <input
                type="checkbox"
                id="isDefaultAddress"
                checked={isDefaultAddress}
                onChange={(e) => setIsDefaultAddress(e.target.checked)}
                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
              />
              <Label htmlFor="isDefaultAddress">Set as default address</Label>
            </div>

            <Button type="submit" className="w-full mt-6" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {loading ? "Saving Profile..." : "Save Profile"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
