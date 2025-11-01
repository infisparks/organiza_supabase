"use client"

import { useEffect, useState } from "react"
import Script from "next/script"

declare global {
  interface Window {
    Razorpay: any
  }
}

interface RazorpayPaymentProps {
  amount: number
  orderId?: string
  name: string
  description: string
  image?: string
  prefill?: {
    name?: string
    email?: string
    contact?: string
    address?: string
  }
  onSuccess: (response: any) => void
  onFailure: (error: any) => void
}

export default function RazorpayPayment({
  amount,
  orderId,
  name,
  description,
  image,
  prefill,
  onSuccess,
  onFailure,
}: RazorpayPaymentProps) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (isReady) {
      const options = {
        key: "rzp_test_0M6qo3zzUUkUCv", // Your Razorpay Key
        amount: amount * 100, // Amount in paisa
        currency: "INR",
        name: name,
        description: description,
        image: image,
        order_id: orderId,
        handler: (response: any) => {
          onSuccess(response)
        },
        prefill: {
          name: prefill?.name || "",
          email: prefill?.email || "",
          contact: prefill?.contact || "",
          method: "card",
        },
        notes: {
          address: prefill?.address || "",
        },
        theme: {
          color: "#10b981", // emerald-600
        },
      }

      const razorpay = new window.Razorpay(options)
      razorpay.on("payment.failed", (response: any) => {
        onFailure(response.error)
      })
      razorpay.open()
    }
  }, [isReady, amount, orderId, name, description, image, prefill, onSuccess, onFailure])

  return (
    <Script
      src="https://checkout.razorpay.com/v1/checkout.js"
      onLoad={() => setIsReady(true)}
      onError={() => onFailure({ description: "Failed to load Razorpay SDK" })}
    />
  )
}
