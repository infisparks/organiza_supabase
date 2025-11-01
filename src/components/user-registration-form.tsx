"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2, AlertCircle, User, Phone, Home, Building, MapPin, Globe } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import { v4 as uuidv4 } from "uuid"

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

export default function UserRegistrationForm() {
  const router = useRouter()
  const { toast } = useToast()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // New states for additional user details
  const [userName, setUserName] = useState("")
  const [primaryPhone, setPrimaryPhone] = useState("")
  const [secondaryPhone, setSecondaryPhone] = useState("")

  // New states for optional address details
  const [houseNumber, setHouseNumber] = useState("")
  const [street, setStreet] = useState("")
  const [area, setArea] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [pincode, setPincode] = useState("")
  const [country, setCountry] = useState("India")
  const [isDefaultAddress, setIsDefaultAddress] = useState(true) // Default to true for initial address

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) throw signUpError

      if (data.user) {
        const userId = data.user.id
        const userEmail = data.user.email

        const addressesToSave: Address[] = []
        if (houseNumber && street && area && city && state && pincode && country && primaryPhone) {
          const newAddress: Address = {
            id: uuidv4(),
            name: `${houseNumber}, ${street}`, // A simple name for the address
            houseNumber,
            street,
            area,
            city,
            state,
            pincode,
            country,
            primaryPhone: primaryPhone, // Use the primary phone from the main form
            secondaryPhone: secondaryPhone || undefined,
            isDefault: isDefaultAddress,
          }
          addressesToSave.push(newAddress)
        }

        // Insert or update user_profiles table
        const { error: profileError } = await supabase.from("user_profiles").upsert(
          {
            id: userId,
            email: userEmail,
            name: userName,
            phone: primaryPhone,
            addresses: addressesToSave,
          },
          { onConflict: "id" }, // Use upsert to handle cases where profile might already exist (e.g., from previous partial registration)
        )

        if (profileError) {
          console.error("Error saving user profile:", profileError)
          throw new Error("Failed to save profile details.")
        }

        toast({
          title: "Registration successful!",
          description: "Please check your email to confirm your account. Redirecting to login...",
          variant: "default",
        })
        router.push("/login") // Redirect to login after successful registration
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-gray-900">Create Your Account</CardTitle>
          <CardDescription className="text-gray-600">Sign up to explore our organic products</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm p-3 bg-red-50 rounded-md border border-red-200">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="userName">Full Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  id="userName"
                  type="text"
                  placeholder="John Doe"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
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
                  onChange={(e) => setPrimaryPhone(e.target.value)}
                  required
                  className="pl-10 h-11"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondaryPhone">Secondary Phone Number (Optional)</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  id="secondaryPhone"
                  type="tel"
                  placeholder="Optional"
                  value={secondaryPhone}
                  onChange={(e) => setSecondaryPhone(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
            </div>

            <h4 className="text-md font-semibold text-gray-800 mt-4">Optional Address Details</h4>
            <div className="space-y-2">
              <Label htmlFor="houseNumber">House/Flat Number</Label>
              <div className="relative">
                <Home className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  id="houseNumber"
                  type="text"
                  placeholder="A-101"
                  value={houseNumber}
                  onChange={(e) => setHouseNumber(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="street">Street/Road Name</Label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  id="street"
                  type="text"
                  placeholder="SV Road"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="area">Area/Locality</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  id="area"
                  type="text"
                  placeholder="Andheri West"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  id="city"
                  type="text"
                  placeholder="Mumbai"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  id="state"
                  type="text"
                  placeholder="Maharashtra"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pincode">Pincode</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  id="pincode"
                  type="text"
                  placeholder="400001"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  id="country"
                  type="text"
                  placeholder="India"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isDefaultAddress"
                checked={isDefaultAddress}
                onCheckedChange={(checked: boolean) => setIsDefaultAddress(checked)}
              />
              <Label htmlFor="isDefaultAddress">Set as Default Address</Label>
            </div>

            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {loading ? "Registering..." : "Register"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-blue-600 hover:underline">
              Login
            </Link>
          </p>
          <p className="mt-4 text-center text-xs text-gray-500">
            Are you a company looking to register?{" "}
            <Link href="/company/registration" className="font-medium text-green-600 hover:underline">
              Register your company here
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
